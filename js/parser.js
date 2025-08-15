// Parser for data.txt → JSON rules
// - Depth: ONLY leading control chars (0x00-0x1F) define depth
// - Routes: lines ending with ':' and not starting with '?' create tree nodes
// - Fields: lines starting with '?' define a variable; store var code and parse tail spec

const FIELD_REGEX = /\?([A-Z]{1,2})(?:\s+([^:]+))?:/u; // 1-2 char variable name

export function parseDataTxtToRules(text) {
	const lines = text.split(/\r?\n/);
	const root = { title: 'ROOT', children: [], depth: -1 };
	const stack = [root];
	let lastFieldHolder = null;

	for (let raw of lines) {
		if (raw == null) continue;
		const depth = computeDepth(raw);
		const noCtrl = raw.replace(/[\x00-\x1F\x7F]/g, '');
		const clean = noCtrl.trimEnd();
		const trimmed = clean.trim();
		if (!trimmed) continue;

		// Route
		if (trimmed.endsWith(':') && !trimmed.startsWith('?')) {
			const title = trimmed.replace(/:$/, '').trim();
			if (!title) continue;
			while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
			const node = { title, children: [], depth };
			stack[stack.length - 1].children.push(node);
			stack.push(node);
			lastFieldHolder = node;
			continue;
		}

		// Field
		const field = parseFieldLine(trimmed);
		if (field) {
			const current = stack[stack.length - 1];
			if (!current.form) current.form = { title: current.title, fields: [], meta: [] };
			if (field.kind === 'meta') current.form.meta.push(field.value);
			else {
				// derive UI spec per provided rules
				field.spec = deriveSpec(field.meta);
				current.form.fields.push(field);
			}
			lastFieldHolder = current;
			continue;
		}

		// Plain meta continuation
		if (lastFieldHolder && /^[\p{L}\p{N}\$#].*/u.test(trimmed)) {
			lastFieldHolder.form = lastFieldHolder.form || { title: lastFieldHolder.title, fields: [], meta: [] };
			lastFieldHolder.form.meta.push(trimmed);
		}
	}

	annotatePaths(root, []);
	return root;
}

function computeDepth(rawLine) {
	let i = 0, ctrl = 0;
	while (i < rawLine.length) {
		const code = rawLine.charCodeAt(i);
		if (code <= 31 || code === 127) { ctrl++; i++; continue; }
		break;
	}
	return ctrl; // ONLY control chars define depth
}

function parseFieldLine(line) {
	// Support optional space after '?' or '#'
	if (line.startsWith('?')) {
		const body = line.slice(1).trimStart();
		const m = body.match(/^([A-Z]{1,2})\s+/);
		if (!m) return null;
		const varCode = m[1];
		const afterCode = body.slice(m[0].length);
		const colon = afterCode.indexOf(':');
		const label = colon >= 0 ? afterCode.slice(0, colon).trim() : afterCode.trim();
		const tail = colon >= 0 ? afterCode.slice(colon + 1).trim() : '';
		const meta = parseRightMeta(tail);
		return { kind: 'field', var: varCode, key: toKey(label || varCode), label: label || varCode, code: varCode, meta };
	}
	if (line.startsWith('#')) {
		const body = line.slice(1).trimStart();
		const colon = body.indexOf(':');
		const label = colon >= 0 ? body.slice(0, colon).trim() : body.trim();
		const tail = colon >= 0 ? body.slice(colon + 1).trim() : '';
		const meta = parseRightMeta(tail);
		const field = { kind: 'field', var: '#', key: toKey(label || 'loop'), label: label || 'loop', code: '#', meta };
		field.spec = { kind: 'loop', loop: true, params: meta.parts };
		return field;
	}
	if (line === '$' || line.startsWith('$ ')) {
		const label = 'sum';
		const meta = parseRightMeta('');
		const field = { kind: 'field', var: '$', key: toKey(label), label, code: '$', meta };
		field.spec = { kind: 'sum', input: 'number' };
		return field;
	}
	// meta-only or not a field line
	if (/^[$#A-Za-zА-Яа-яЇїІіЄєҐґ0-9].*/u.test(line)) return { kind: 'meta', value: line };
	return null;
}

function toKey(label) {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9а-яёїієґ\s]/gi, '')
		.trim()
		.replace(/\s+/g, '_') || 'field';
}

function parseRightMeta(rest) {
	const parts = rest ? rest.split('·').map(s => s.trim()).filter(Boolean) : [];
	return { raw: rest || '', parts };
}

function deriveSpec(meta) {
	const spec = { kind: 'open', editable: true, params: [] };
	if (!meta || !meta.parts || meta.parts.length === 0) return spec;
	const p = meta.parts;
	let i = 0;
	function isCode(tok) { return /^[A-Z]{1,2}$/.test(tok); }
	function takeUntilNextCode(start) {
		const out = [];
		for (let j = start; j < p.length; j++) {
			if (isCode(p[j]) && j !== start) break;
			out.push(p[j]);
		}
		return out;
	}
	while (i < p.length) {
		const t = p[i];
		if (t === 'R') {
			spec.kind = 'run'; spec.editable = false;
			const params = takeUntilNextCode(i + 1);
			spec.params.push({ code: 'R', params });
			i += 1 + params.length; continue;
		}
		if (t === 'X') {
			spec.kind = 'run'; spec.editable = true;
			const params = takeUntilNextCode(i + 1);
			spec.params.push({ code: 'X', params });
			i += 1 + params.length; continue;
		}
		if (t === 'C') {
			spec.input = 'select';
			const params = takeUntilNextCode(i + 1);
			const [menuTitle, ...options] = params;
			spec.menuTitle = menuTitle || '';
			spec.options = options;
			spec.params.push({ code: 'C', params });
			i += 1 + params.length; continue;
		}
		if (t === 'S') {
			spec.input = 'string';
			const params = takeUntilNextCode(i + 1);
			const [def, maxLen] = params;
			spec.default = def ?? '';
			spec.max = maxLen ? Number(maxLen) : undefined;
			spec.params.push({ code: 'S', params });
			i += 1 + params.length; continue;
		}
		if (t === 'N') {
			spec.input = 'number';
			const params = takeUntilNextCode(i + 1);
			const [def, min, max] = params;
			spec.default = toNum(def);
			spec.min = toNum(min);
			spec.max = toNum(max);
			spec.params.push({ code: 'N', params });
			i += 1 + params.length; continue;
		}
		if (t.startsWith('#')) {
			spec.loop = true;
			const params = takeUntilNextCode(i + 1);
			spec.params.push({ code: '#', params: [t.slice(1), ...params] });
			i += 1 + params.length; continue;
		}
		if (/^multiline$/i.test(t)) { spec.multiline = true; i++; continue; }
		// everything else: open list with params
		const params = takeUntilNextCode(i);
		if (params.length) {
			spec.kind = spec.kind === 'open' ? 'open' : spec.kind;
			spec.params.push({ code: 'OPEN', params });
			i += params.length; continue;
		}
		i++;
	}
	return spec;
}

function toNum(v) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : undefined; }

function annotatePaths(node, path) {
	node.path = [...path, node.title].filter(Boolean);
	if (node.form) node.form.path = node.path;
	for (const child of (node.children || [])) annotatePaths(child, node.path);
}
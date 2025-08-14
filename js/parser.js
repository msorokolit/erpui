// Parser for data.txt → JSON rules
// - Headings: lines ending with ':' create tree nodes (routes)
// - Fields: lines with ?XX tokens are attached to the nearest heading
// - Depth: USE leading control chars (0x00-0x1F) together with tabs/spaces; control chars are not shown in UI

const FIELD_REGEX = /\?([A-Z]{1,3}[0-9]?)(?:\s+([^:]+))?:/u;

export function parseDataTxtToRules(text) {
	const lines = text.split(/\r?\n/);
	const root = { title: 'ROOT', children: [], depth: -1 };
	const stack = [root];
	let lastFieldHolder = null;

	for (let raw of lines) {
		if (raw == null) continue;
		const depth = computeDepth(raw);
		// Strip ALL control chars from the line for parsing and UI
		const noCtrl = raw.replace(/[\x00-\x1F\x7F]/g, '');
		const clean = noCtrl.trimEnd();
		const trimmed = clean.trim();
		if (!trimmed) continue;

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

		const field = parseFieldLine(trimmed);
		if (field) {
			const current = stack[stack.length - 1];
			if (!current.form) current.form = { title: current.title, fields: [], meta: [] };
			if (field.kind === 'meta') current.form.meta.push(field.value);
			else current.form.fields.push(field);
			lastFieldHolder = current;
			continue;
		}

		if (lastFieldHolder && /^[\p{L}\p{N}\$#].*/u.test(trimmed)) {
			lastFieldHolder.form = lastFieldHolder.form || { title: lastFieldHolder.title, fields: [], meta: [] };
			lastFieldHolder.form.meta.push(trimmed);
		}
	}

	annotatePaths(root, []);
	return root;
}

function computeDepth(rawLine) {
	// Count leading control chars (0x00-0x1F), tabs, and spaces until first printable non-space
	let i = 0, ctrl = 0, spaces = 0;
	while (i < rawLine.length) {
		const ch = rawLine[i];
		const code = rawLine.charCodeAt(i);
		if (code <= 31 || code === 127) { ctrl++; i++; continue; }
		if (ch === ' ') { spaces++; i++; continue; }
		if (ch === '\t') { spaces += 4; i++; continue; }
		break;
	}
	// Each control char contributes one level, plus indentation from spaces/tabs (2 spaces ~ 1 level)
	return ctrl + Math.floor(spaces / 2);
}

function parseFieldLine(line) {
	const m = line.match(FIELD_REGEX);
	if (!m) {
		if (/^[$#A-Za-zА-Яа-яЇїІіЄєҐґ0-9].*/u.test(line)) return { kind: 'meta', value: line };
		return null;
	}
	const code = m[1];
	const label = (m[2] || '').trim();
	const rest = line.slice(m.index + m[0].length).trim();
	const type = mapCodeToType(code);
	const meta = parseRightMeta(rest);
	const constraints = deriveConstraints(meta);
	return { kind: 'field', key: toKey(label || code), label: label || code, code, type, meta, constraints };
}

function toKey(label) {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9а-яёїієґ\s]/gi, '')
		.trim()
		.replace(/\s+/g, '_') || 'field';
}

function mapCodeToType(code) {
	switch (true) {
		case /^R/.test(code): return 'ref';
		case /^N/.test(code): return 'number';
		case /^S$/.test(code): return 'text';
		case /^D/.test(code): return 'date';
		case /^C$/.test(code): return 'select';
		case /^I$/.test(code): return 'vat';
		case /^B/.test(code): return 'amount';
		case /^Q/.test(code): return 'quantity';
		case /^Z/.test(code): return 'price';
		case /^T/.test(code): return 'text';
		default: return 'text';
	}
}

function parseRightMeta(rest) {
	if (!rest) return { raw: '', tokens: [], refs: [], numbers: [], text: [] };
	const raw = rest;
	const parts = raw.split('·').map(s => s.trim()).filter(Boolean);
	const tokens = [];
	const refs = [];
	const numbers = [];
	const text = [];
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		if (/^[A-Z]{1,3}$/i.test(p) && (i + 1) < parts.length && /^[A-Z0-9]+$/i.test(parts[i + 1])) {
			refs.push({ code: p.toUpperCase(), arg: parts[i + 1] });
			tokens.push(p, parts[i + 1]);
			i++;
			continue;
		}
		if (/^-?\d+(?:[.,]\d+)?$/.test(p)) { numbers.push(p.replace(',', '.')); tokens.push(p); continue; }
		if (p) { text.push(p); tokens.push(p); }
	}
	return { raw, tokens, refs, numbers, text };
}

function deriveConstraints(meta) {
	const c = {};
	if (!meta || !meta.numbers || meta.numbers.length === 0) return c;
	if (meta.numbers.length >= 2) {
		const nums = meta.numbers.map(parseFloat).filter(n => Number.isFinite(n));
		if (nums.length >= 2) {
			c.min = Math.min(nums[0], nums[1]);
			c.max = nums[nums.length - 1];
		}
	}
	return c;
}

function annotatePaths(node, path) {
	// Path contains only headings (routes), never fields
	node.path = [...path, node.title].filter(Boolean);
	if (node.form) node.form.path = node.path;
	for (const child of (node.children || [])) annotatePaths(child, node.path);
}
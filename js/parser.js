// Parser for data.txt → JSON rules
// Heuristics:
// - Indentation depth defines tree level (count of leading control chars and spaces)
// - Headings: lines ending with ':' are nodes (groups or actions)
// - Field lines contain tokens like ?R, ?N, ?S, ?D, ?C, ?I, ?B1, ?Q, ?Z, etc. We map to field types
// - Account codes on right like "·R 37 ·1·" are captured as meta

const FIELD_REGEX = /\?([A-Z]{1,2}[0-9]?)(?:\s+([^:]+))?:/u;

export function parseDataTxtToRules(text) {
	const lines = text.split(/\r?\n/);
	const root = { title: 'ROOT', children: [], level: 0 };
	const stack = [root];

	for (let raw of lines) {
		if (!raw) continue;
		const line = raw.replace(/\u0000|\u0001|\u0002|\u0010|\u0011|\u000f|\u0012|\u0013|\u0014|\u0015|\u0016|\u0017|\u0018|\u0019|\u001a/g, '').trimEnd();
		const trimmed = line.trim();
		if (!trimmed) continue;

		const level = computeIndentLevel(raw);
		// Adjust stack
		while (stack.length && stack[stack.length - 1].level >= level + 1) stack.pop();

		if (trimmed.endsWith(':')) {
			const title = trimmed.replace(/:$/, '').trim();
			const node = { title, children: [], level: level + 1 };
			(stack[stack.length - 1].children).push(node);
			stack.push(node);
			continue;
		}

		// Field line for current node: attach to nearest actionable node (last heading)
		const current = stack[stack.length - 1];
		const field = parseFieldLine(trimmed);
		if (field) {
			if (!current.form) current.form = { title: current.title, fields: [], meta: [] };
			if (field.kind === 'meta') current.form.meta.push(field.value);
			else current.form.fields.push(field);
		}
	}

	annotatePaths(root, []);
	return root;
}

function computeIndentLevel(raw) {
	// Count leading control chars and tabs/spaces as nesting
	let count = 0;
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (ch === ' ' || ch === '\t' || ch.charCodeAt(0) < 32) count++;
		else break;
	}
	// Coarsen
	return Math.floor(count / 2);
}

function parseFieldLine(line) {
	const m = line.match(FIELD_REGEX);
	if (!m) {
		// meta tails like "$" or codes like "Z ·9·"; capture as meta
		if (/^[$A-Za-z0-9].*/.test(line)) {
			return { kind: 'meta', value: line };
		}
		return null;
	}
	const code = m[1];
	const label = (m[2] || '').trim();
	const rest = line.slice(m.index + m[0].length).trim();
	const type = mapCodeToType(code, rest);
	const meta = parseRightMeta(rest);
	return { kind: 'field', key: toKey(label || code), label: label || code, code, type, meta };
}

function toKey(label) {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9а-яёіїєґ\s]/gi, '')
		.trim()
		.replace(/\s+/g, '_') || 'field';
}

function mapCodeToType(code, tail) {
	switch (true) {
		case /^R/.test(code): return 'ref'; // reference
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
	// capture tokens like ·R 37 ·1· or lists like C·Метод:·1 ...
	const meta = [];
	if (!rest) return meta;
	meta.push(rest);
	return meta;
}

function annotatePaths(node, path) {
	node.path = [...path, node.title].filter(Boolean);
	if (node.form) node.form.path = node.path;
	for (const child of (node.children || [])) annotatePaths(child, node.path);
}
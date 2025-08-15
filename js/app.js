// Minimal client-only ERP UI (simplified)

import { parseDataTxtToRules } from './parser.js';
import { buildTree, renderTree } from './tree.js';

const state = {
	text: '',
	rules: null,
	tree: null,
	currentPath: [],
};

const els = {
	nav: document.getElementById('nav'),
	content: document.getElementById('content'),
	intro: document.getElementById('intro'),
	docs: document.getElementById('docs'),
	fileInput: document.getElementById('fileInput'),
	loadFileBtn: document.getElementById('loadFileBtn'),
};

async function loadDataTxt() {
	const cacheKey = 'erp_data_txt_v1';
	const cached = localStorage.getItem(cacheKey);
	if (cached) return cached;
	const res = await fetch('./data.txt');
	if (!res.ok) throw new Error('Cannot load data.txt');
	const txt = await res.text();
	localStorage.setItem(cacheKey, txt);
	return txt;
}

async function ensureRules() {
	if (state.rules) return state.rules;
	state.text = await loadDataTxt();
	state.rules = parseDataTxtToRules(state.text);
	state.tree = buildTree(state.rules);
	return state.rules;
}

function onSelectNode(node) {
	state.currentPath = node.path;
	els.intro.style.display = 'none';
	renderTable(node);
}

function renderTable(node) {
	const fields = (node.form?.fields || []);
	const meta = (node.form?.meta || []);
	const title = node.title;
	const breadcrumbs = node.path.join(' / ');
	const table = `
		<div class="card">
			<h3>${escapeHtml(title)}</h3>
			<div class="small">${escapeHtml(breadcrumbs)}</div>
			<table style="width:100%; border-collapse: collapse; margin-top: 8px;">
				<thead>
					<tr>
						<th style="text-align:left; border-bottom:1px solid #273043; padding:6px 4px;">Питання</th>
						<th style="text-align:left; border-bottom:1px solid #273043; padding:6px 4px;">Опис (розбір)</th>
					</tr>
				</thead>
				<tbody>
					${fields.map(f => `
						<tr>
							<td style="padding:6px 4px; border-bottom:1px dashed #273043;">${escapeHtml(renderQuestion(f))}</td>
							<td style="padding:6px 4px; border-bottom:1px dashed #273043;">${escapeHtml(renderSpec(f))}</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
			${renderSummary(fields, meta)}
		</div>
	`;
	els.content.innerHTML = table;
	els.docs.innerHTML = '';
}

function renderQuestion(f) {
	// Build readable question label: var code + label
	if (f.code === '$') return '$ sum';
	if (f.code === '#') return `# ${f.label}`;
	return `${f.var} ${f.label}`.trim();
}

function renderSpec(f) {
	const s = f.spec || {};
	const parts = f.meta?.parts || [];
	if (s.kind === 'sum') return 'number (sum)';
	if (s.kind === 'loop') return `loop: ${parts.join(' | ')}`;
	if (s.input === 'select') {
		const opts = (s.options||[]).join(', ');
		return `select: ${s.menuTitle || ''}${opts ? ' ['+opts+']' : ''}`.trim();
	}
	if (s.input === 'string') {
		const bits = [];
		if (s.default != null) bits.push(`default=${s.default}`);
		if (s.max != null) bits.push(`max=${s.max}`);
		return `string${bits.length?': '+bits.join(', '):''}`;
	}
	if (s.input === 'number') {
		const bits = [];
		if (s.default != null) bits.push(`default=${s.default}`);
		if (s.min != null) bits.push(`min=${s.min}`);
		if (s.max != null) bits.push(`max=${s.max}`);
		return `number${bits.length?': '+bits.join(', '):''}`;
	}
	if (s.kind === 'run') {
		const runs = (s.params||[]).map(r => `${r.code}(${(r.params||[]).join(', ')})`).join(' ; ');
		return `${s.editable ? 'run(editable)' : 'run(readonly)'}${runs?': '+runs:''}`;
	}
	if (s.params && s.params.length) {
		return s.params.map(p => p.params.join(' ')).join(' | ');
	}
	return parts.join(' ');
}

function renderSummary(fields, meta) {
	const sumFields = fields.filter(f => f.code === '$' || f.spec?.kind === 'sum');
	const loopFields = fields.filter(f => f.spec?.kind === 'loop');
	const hasMeta = Array.isArray(meta) && meta.length > 0;
	if (!sumFields.length && !loopFields.length && !hasMeta) return '';
	let html = '<div style="margin-top:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap:12px;">';
	if (sumFields.length) {
		html += '<div class="card"><h3>Σ Підсумок</h3><ul style="margin:6px 0 0 16px;">';
		for (const f of sumFields) {
			html += `<li>${escapeHtml(renderQuestion(f))} — ${escapeHtml(renderSpec(f))}</li>`;
		}
		html += '</ul></div>';
	}
	if (loopFields.length) {
		html += '<div class="card"><h3>Списки</h3><ul style="margin:6px 0 0 16px;">';
		for (const f of loopFields) {
			html += `<li>${escapeHtml(f.label)} — ${escapeHtml(renderSpec(f))}</li>`;
		}
		html += '</ul></div>';
	}
	if (hasMeta) {
		html += '<div class="card"><h3>Параметри розділу</h3><ul style="margin:6px 0 0 16px;">';
		for (const m of meta) html += `<li>${escapeHtml(m)}</li>`;
		html += '</ul></div>';
	}
	html += '</div>';
	return html;
}

function hookHeaderActions() {
	els.loadFileBtn.addEventListener('click', () => els.fileInput.click());
	els.fileInput.addEventListener('change', async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const txt = await file.text();
		localStorage.setItem('erp_data_txt_v1', txt);
		state.text = txt;
		state.rules = parseDataTxtToRules(state.text);
		state.tree = buildTree(state.rules);
		els.intro.style.display = 'none';
		els.content.innerHTML = '';
		els.docs.innerHTML = '';
		renderTree(els.nav, state.tree, onSelectNode, '');
	});
}

(async function boot(){
	try {
		await ensureRules();
		hookHeaderActions();
		renderTree(els.nav, state.tree, onSelectNode, '');
	} catch (err) {
		console.error(err);
		hookHeaderActions();
		els.intro.style.display = '';
		els.content.innerHTML = '';
		els.docs.innerHTML = '';
		els.intro.innerHTML = `
			<div class="card">
				<h3>Помилка завантаження</h3>
				<div class="small">Не вдається завантажити <code>data.txt</code>. Завантажте файл вручну кнопкою "Load file" у верхній панелі або запустіть локальний HTTP сервер.</div>
			</div>
		`;
	}
})();

function escapeHtml(s){
	return String(s ?? '').replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function prettyMeta(meta) {
	if (!meta) return '';
	if (meta.text && meta.text.length) return meta.text.join(' ');
	if (Array.isArray(meta)) return meta.join(' ');
	return meta.raw || '';
}
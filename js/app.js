// Minimal client-only ERP UI

import { parseDataTxtToRules } from './parser.js';
import { buildTree, renderTree } from './tree.js';
import { renderForm, restoreDoc, saveDoc } from './forms.js';

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
	search: document.getElementById('searchInput'),
	exportJsonBtn: document.getElementById('exportJsonBtn'),
	clearCacheBtn: document.getElementById('clearCacheBtn'),
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
	els.content.innerHTML = '';
	const formSpec = node.form || null;
	if (!formSpec) {
		els.content.innerHTML = `<div class="card"><h3>${escapeHtml(node.title)}</h3><div class="small">Немає полів для цієї дії.</div></div>`;
		els.docs.innerHTML = '';
		return;
	}
	const form = renderForm(formSpec, {
		onSave: (data) => {
			saveDoc(node.path, data);
			toast('Збережено');
		},
		onLoad: () => restoreDoc(node.path),
	});
	els.content.appendChild(form);
	els.docs.innerHTML = docBlock(node);
}

function docBlock(node) {
	const breadcrumbs = node.path.join(' / ');
	const fields = (node.form?.fields || []).map(f => `${f.key} (${f.type})`).join(', ');
	return `
		<div class="card">
			<h3>Опис</h3>
			<div class="kv">
				<div>Шлях</div><div>${escapeHtml(breadcrumbs)}</div>
				<div>Поля</div><div>${escapeHtml(fields)}</div>
			</div>
			<div class="small">Вузлів: ${(node.children||[]).length} • Полів: ${(node.form?.fields||[]).length}</div>
		</div>
	`;
}

function toast(msg) {
	const el = document.createElement('div');
	el.textContent = msg;
	el.style.position = 'fixed';
	el.style.bottom = '16px';
	el.style.right = '16px';
	el.style.background = 'rgba(0,0,0,.8)';
	el.style.padding = '8px 10px';
	el.style.border = '1px solid #273043';
	el.style.borderRadius = '8px';
	document.body.appendChild(el);
	setTimeout(() => el.remove(), 1600);
}

function hookHeaderActions() {
	els.exportJsonBtn.addEventListener('click', () => {
		const blob = new Blob([JSON.stringify(state.rules, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = 'rules.json'; a.click();
		URL.revokeObjectURL(url);
	});
	els.clearCacheBtn.addEventListener('click', () => {
		localStorage.removeItem('erp_data_txt_v1');
		location.reload();
	});
	els.search.addEventListener('input', () => {
		renderTree(els.nav, state.tree, onSelectNode, els.search.value.trim());
	});
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
		toast('Завантажено файл правил');
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
				<div class="small">Не вдається завантажити <code>data.txt</code>. Ви можете завантажити файл вручну кнопкою "Load file" у верхній панелі або запустити локальний HTTP сервер.</div>
			</div>
		`;
	}
})();

function escapeHtml(s){
	return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
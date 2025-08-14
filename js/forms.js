const STORAGE_PREFIX = 'erp_docs_v1:';

export function renderForm(formSpec, { onSave, onLoad }) {
	const wrapper = document.createElement('div');
	wrapper.className = 'card';

	const h = document.createElement('h3');
	h.textContent = formSpec.title;
	wrapper.appendChild(h);

	const grid = document.createElement('div');
	grid.className = 'grid';
	wrapper.appendChild(grid);

	const values = (onLoad && onLoad()) || {};

	for (const field of (formSpec.fields || [])) {
		const fieldEl = renderField(field, values[field.key]);
		grid.appendChild(fieldEl);
	}

	const actions = document.createElement('div');
	actions.className = 'actions';
	const saveBtn = document.createElement('button');
	saveBtn.className = 'button';
	saveBtn.textContent = 'Зберегти';
	saveBtn.addEventListener('click', () => {
		const data = collect(wrapper, formSpec.fields);
		onSave && onSave(data);
		saveLocal(formSpec.path, data);
	});
	const clearBtn = document.createElement('button');
	clearBtn.className = 'button secondary';
	clearBtn.textContent = 'Очистити';
	clearBtn.addEventListener('click', () => {
		for (const input of wrapper.querySelectorAll('[data-key]')) input.value = '';
		saveLocal(formSpec.path, {});
	});
	const toggleMetaBtn = document.createElement('button');
	toggleMetaBtn.className = 'button ghost';
	toggleMetaBtn.textContent = 'Метадані';
	toggleMetaBtn.addEventListener('click', () => {
		metaEl.style.display = metaEl.style.display === 'none' ? '' : 'none';
	});
	actions.appendChild(saveBtn);
	actions.appendChild(clearBtn);
	actions.appendChild(toggleMetaBtn);
	wrapper.appendChild(actions);

	const metaEl = document.createElement('div');
	metaEl.style.display = 'none';
	metaEl.style.marginTop = '10px';
	metaEl.innerHTML = `<div class="small">${escapeHtml((formSpec.meta||[]).join(' \n '))}</div>`;
	wrapper.appendChild(metaEl);

	// autosave on input
	wrapper.addEventListener('input', () => {
		const data = collect(wrapper, formSpec.fields);
		saveLocal(formSpec.path, data);
	});

	return wrapper;
}

function renderField(field, value) {
	const wrap = document.createElement('div');
	wrap.className = 'form-field';
	wrap.dataset.key = field.key;
	const label = document.createElement('label');
	label.textContent = field.label;
	wrap.appendChild(label);

	let input;
	switch (field.type) {
		case 'number':
			input = document.createElement('input'); input.type = 'number'; input.step = 'any'; break;
		case 'amount':
			input = document.createElement('input'); input.type = 'number'; input.step = '0.01'; break;
		case 'quantity':
			input = document.createElement('input'); input.type = 'number'; input.step = '0.0001'; break;
		case 'date':
			input = document.createElement('input'); input.type = 'text'; input.placeholder = 'дд.мм.рр або дд.мм.рррр'; break;
		case 'select':
			input = document.createElement('select');
			const opts = parseSelectOptions(field.meta);
			for (const { value, label } of opts) { const o = document.createElement('option'); o.value = value; o.textContent = label; input.appendChild(o); }
			break;
		case 'vat':
			input = document.createElement('select');
			[{value:'20',label:'ПДВ 20%'},{value:'0',label:'ПДВ 0%'}].forEach(o=>{const opt=document.createElement('option');opt.value=o.value;opt.textContent=o.label;input.appendChild(opt);});
			break;
		case 'ref':
			input = document.createElement('input'); input.type = 'text'; input.placeholder = refPlaceholder(field.meta); break;
		default:
			input = document.createElement('input'); input.type = 'text'; break;
	}
	if (field.constraints) {
		if (typeof field.constraints.min === 'number') input.min = String(field.constraints.min);
		if (typeof field.constraints.max === 'number') input.max = String(field.constraints.max);
	}
	input.value = value ?? '';
	input.dataset.key = field.key;
	wrap.appendChild(input);
	if (field.meta && field.meta.raw) {
		const small = document.createElement('div'); small.className = 'small'; small.textContent = prettyMeta(field.meta); wrap.appendChild(small);
	}
	return wrap;
}

function parseSelectOptions(meta) {
	const result = [];
	if (!meta || !meta.text) return result;
	const parts = meta.text; // array strings
	// Attempt to pair number -> next token as label from tokens
	const tokens = meta.tokens || [];
	for (let i=0;i<tokens.length;i++) {
		const t = tokens[i];
		if (/^\d+$/.test(t) && tokens[i+1]) {
			result.push({ value: t, label: tokens[i+1] });
			i++;
		}
	}
	return result;
}

function refPlaceholder(meta) {
	if (!meta || !meta.refs || !meta.refs.length) return 'код/посилання';
	const r = meta.refs.find(r => r.code.toUpperCase()==='R');
	return r ? `посилання на ${r.arg}` : 'код/посилання';
}

function collect(wrapper, fields) {
	const data = {};
	for (const f of fields) {
		const el = wrapper.querySelector(`[data-key="${CSS.escape(f.key)}"]`);
		if (!el) continue;
		data[f.key] = el.value;
	}
	return data;
}

function saveLocal(path, data) {
	const key = STORAGE_PREFIX + path.join('>');
	localStorage.setItem(key, JSON.stringify(data));
}

export function saveDoc(path, data) { saveLocal(path, data); }

export function restoreDoc(path) {
	const key = STORAGE_PREFIX + path.join('>');
	const raw = localStorage.getItem(key);
	return raw ? JSON.parse(raw) : {};
}

function prettyMeta(meta) {
	const refStr = (meta.refs||[]).map(r=>`${r.code} ${r.arg}`).join(', ');
	const numStr = (meta.numbers||[]).join(' | ');
	const txtStr = (meta.text||[]).join(' ');
	return [refStr, numStr, txtStr].filter(Boolean).join(' • ');
}

function escapeHtml(s){ return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
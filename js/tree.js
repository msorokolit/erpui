export function buildTree(rootRules) {
	return rootRules;
}

export function renderTree(container, tree, onSelect, query) {
	container.innerHTML = '';
	const ul = document.createElement('ul');
	ul.className = 'tree';
	container.appendChild(ul);
	for (const child of (tree.children || [])) renderNode(ul, child, 0, [], onSelect);
}

function renderNode(container, node, depth, parentPath, onSelect) {
	const path = [...parentPath, node.title];
	const li = document.createElement('li'); li.className = 'tree-item';
	const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='6px';
	const hasChildren = (node.children||[]).length > 0;
	const toggle = document.createElement('button');
	toggle.className='tree-btn'; toggle.style.width='auto'; toggle.style.minWidth='28px';
	toggle.textContent = hasChildren ? '▸' : '';
	let expanded = depth <= 1;
	toggle.addEventListener('click', () => { if (!hasChildren) return; expanded = !expanded; toggle.textContent = expanded ? '▾' : '▸'; childBox.style.display = expanded ? '' : 'none'; });
	const btn = document.createElement('button'); btn.className='tree-btn'; btn.style.flex='1'; btn.dataset.path = path.join('>');
	const fieldCount = (node.form?.fields || []).length;
	btn.appendChild(document.createTextNode(node.title));
	if (fieldCount > 0) {
		const sep = document.createTextNode(' · ');
		btn.appendChild(sep);
		const small = document.createElement('span');
		small.className = 'small';
		small.textContent = `${fieldCount} полів`;
		btn.appendChild(small);
	}
	btn.addEventListener('click', () => onSelect({ ...node, path }));
	row.appendChild(toggle); row.appendChild(btn); li.appendChild(row);
	const childBox = document.createElement('div'); childBox.style.marginLeft='20px'; li.appendChild(childBox);
	container.appendChild(li);
	if (!expanded) childBox.style.display='none'; else if (hasChildren) toggle.textContent='▾';
	for (const child of (node.children||[])) renderNode(childBox, child, depth+1, path, onSelect);
}

function flatten(node, path, out) {
	node.__id = out.length;
	const formTitles = (node.form?.fields || []).map(f => f.label).join(' ');
	out.push({ id: out.length, title: node.title, pathText: [...path, node.title].join(' / '), fields: formTitles });
	for (const child of (node.children||[])) flatten(child, [...path, node.title], out);
}

function fuzzySearch(items, query) {
	const q = query.trim().toLowerCase();
	if (!q) return items;
	const words = q.split(/\s+/).filter(Boolean);
	return items.filter(it => {
		const hay = `${it.title} ${it.pathText} ${it.fields}`.toLowerCase();
		return words.every(w => hay.includes(w));
	});
}

function highlightTitle(title, q){
	if (!q) return escapeHtml(title);
	const re = new RegExp(`(${escapeRegex(q)})`, 'ig');
	return escapeHtml(title).replace(re, '<mark>$1</mark>');
}

function escapeHtml(s){ return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function buildTree(rootRules) {
	return rootRules;
}

export function renderTree(container, tree, onSelect, query) {
	container.innerHTML = '';
	const flat = [];
	flatten(tree, [], flat);
	const idsToShow = query ? new Set(fuzzySearch(flat, query).map(i => i.id)) : null;

	const ul = document.createElement('ul');
	ul.className = 'tree';
	container.appendChild(ul);

	for (const child of (tree.children || [])) {
		renderNode(ul, child, 0, [], idsToShow, onSelect, query);
	}
}

function renderNode(container, node, depth, parentPath, idsToShow, onSelect, query) {
	const path = [...parentPath, node.title];
	const li = document.createElement('li'); li.className = 'tree-item';
	const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='6px';
	const hasChildren = (node.children||[]).length > 0;
	const toggle = document.createElement('button'); toggle.textContent = hasChildren ? '▸' : '·'; toggle.className='tree-btn'; toggle.style.width='auto'; toggle.style.minWidth='28px';
	let expanded = depth <= 1;
	toggle.addEventListener('click', () => { if (!hasChildren) return; expanded = !expanded; toggle.textContent = expanded ? '▾' : '▸'; childBox.style.display = expanded ? '' : 'none'; });
	const btn = document.createElement('button'); btn.className='tree-btn'; btn.style.flex='1'; btn.dataset.path = path.join('>'); btn.innerHTML = highlightTitle(node.title, query);
	btn.addEventListener('click', () => onSelect({ ...node, path }));
	if (idsToShow && !idsToShow.has(node.__id)) { li.style.display = 'none'; }
	row.appendChild(toggle); row.appendChild(btn); li.appendChild(row);
	const childBox = document.createElement('div'); childBox.style.marginLeft='20px'; li.appendChild(childBox);
	container.appendChild(li);
	if (!expanded) childBox.style.display='none'; else toggle.textContent='▾';
	for (const child of (node.children||[])) renderNode(childBox, child, depth+1, path, idsToShow, onSelect, query);
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
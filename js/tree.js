export function buildTree(rootRules) {
	// Root already structured; return it
	return rootRules;
}

export function renderTree(container, tree, onSelect, query) {
	container.innerHTML = '';
	const ul = document.createElement('ul');
	ul.className = 'tree';
	container.appendChild(ul);

	function visit(node, depth, parentPath) {
		if (!node) return;
		const path = [...(parentPath || []), node.title];
		if (node.title !== 'ROOT') {
			const li = document.createElement('li');
			li.className = 'tree-item';
			const btn = document.createElement('button');
			btn.className = 'tree-btn';
			btn.dataset.path = path.join('>');
			btn.innerHTML = `${'&nbsp;'.repeat(depth*2)}${escapeHtml(node.title)}`;
			btn.addEventListener('click', () => onSelect({ ...node, path }));
			if (query && !matches(node, query)) {
				btn.style.display = 'none';
			}
			li.appendChild(btn);
			ul.appendChild(li);
		}
		for (const child of (node.children || [])) visit(child, depth + (node.title==='ROOT'?0:1), path);
	}
	visit(tree, 0, []);
}

function matches(node, q) {
	const lq = q.toLowerCase();
	if (node.title?.toLowerCase().includes(lq)) return true;
	if (node.form?.fields?.some(f => (f.label||'').toLowerCase().includes(lq))) return true;
	return false;
}

function escapeHtml(s){
	return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
const FILE_ICONS = {
  '.js': '🟨',
  '.ts': '🔷',
  '.jsx': '⚛️',
  '.tsx': '⚛️',
  '.py': '🐍',
  '.rs': '🦀',
  '.go': '🐹',
  '.java': '☕',
  '.json': '📋',
  '.html': '🌐',
  '.css': '🎨',
  '.md': '📝',
  '.sh': '🐚',
  '.yml': '⚙️',
  '.yaml': '⚙️',
  '.toml': '⚙️',
  '.sql': '🗃️',
  '.c': '🔧',
  '.cpp': '🔧',
};

export class FileTree {
  constructor(containerId, socket) {
    this.container = document.getElementById(containerId);
    this.socket = socket;
    this.tree = null;
    this.selectedPath = null;
    this.expandedDirs = new Set();
    this.onFileSelect = null;
  }

  async load(path) {
    this.socket.send(JSON.stringify({
      type: 'editor-tree',
      path: path || '.',
    }));
  }

  handleTreeData(data) {
    this.tree = data;
    this.render();
  }

  render() {
    if (!this.container || !this.tree) return;
    this.container.innerHTML = '';

    const fragment = document.createDocumentFragment();
    if (Array.isArray(this.tree)) {
      for (const node of this.tree) {
        this.renderNode(node, 0, fragment);
      }
    } else {
      this.renderNode(this.tree, 0, fragment);
    }
    this.container.appendChild(fragment);
  }

  renderNode(node, depth, parent) {
    const item = document.createElement('div');
    item.className = 'tree-item ' + (node.type === 'directory' ? 'directory' : 'file');
    item.style.setProperty('--depth', depth);
    item.style.paddingLeft = `${depth * 16 + 8}px`;
    item.dataset.path = node.path;
    item.dataset.type = node.type;

    if (node.path === this.selectedPath) {
      item.classList.add('selected');
    }

    if (node.type === 'directory') {
      const expanded = this.expandedDirs.has(node.path);
      const toggle = document.createElement('span');
      toggle.className = 'tree-toggle';
      toggle.textContent = expanded ? '▼' : '▶';
      item.appendChild(toggle);

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = '📁';
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'tree-name';
      name.textContent = node.name;
      item.appendChild(name);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDirectory(node.path);
      });

      parent.appendChild(item);

      if (expanded && node.children) {
        for (const child of node.children) {
          this.renderNode(child, depth + 1, parent);
        }
      }
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-toggle';
      spacer.textContent = ' ';
      item.appendChild(spacer);

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = this.getFileIcon(node.name);
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'tree-name';
      name.textContent = node.name;
      item.appendChild(name);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectFile(node.path);
        if (this.onFileSelect) this.onFileSelect(node.path);
      });

      parent.appendChild(item);
    }
  }

  toggleDirectory(path) {
    if (this.expandedDirs.has(path)) {
      this.expandedDirs.delete(path);
    } else {
      this.expandedDirs.add(path);
    }
    this.render();
  }

  selectFile(path) {
    const prev = this.container.querySelector('.tree-item.selected');
    if (prev) prev.classList.remove('selected');

    this.selectedPath = path;
    const el = this.container.querySelector(`.tree-item[data-path="${CSS.escape(path)}"]`);
    if (el) el.classList.add('selected');
  }

  getFileIcon(name) {
    const ext = '.' + name.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || '📄';
  }
}

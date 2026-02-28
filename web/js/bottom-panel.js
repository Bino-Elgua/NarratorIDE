/**
 * Bottom Panel - Resizable, tabbed (Problems, Queue, Terminal)
 * Inspired by VS Code / Cursor bottom panel
 */

const bottomPanel = {
  container: document.getElementById('bottomPanel'),
  splitter: document.getElementById('bottomSplitter'),
  tabs: document.querySelectorAll('.bottom-tab'),
  minHeight: 80,
  maxHeight: 600,
  isDragging: false,

  init() {
    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Splitter drag
    this.splitter.addEventListener('mousedown', () => this.startDrag());
    document.addEventListener('mousemove', (e) => this.onDrag(e));
    document.addEventListener('mouseup', () => this.endDrag());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.code === 'KeyJ') {
        e.preventDefault();
        this.toggle();
      }
    });
  },

  switchTab(tabName) {
    // Update active tab
    this.tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // Show/hide panels
    document.querySelectorAll('.bottom-tab-panel').forEach(panel => {
      panel.style.display = panel.id === `${tabName}-panel` ? 'block' : 'none';
    });
  },

  startDrag() {
    this.isDragging = true;
    this.splitter.style.background = 'var(--accent-primary)';
  },

  onDrag(e) {
    if (!this.isDragging) return;

    const newHeight = window.innerHeight - e.clientY;
    if (newHeight >= this.minHeight && newHeight <= this.maxHeight) {
      this.container.style.height = newHeight + 'px';
    }
  },

  endDrag() {
    this.isDragging = false;
    this.splitter.style.background = 'var(--border)';
  },

  toggle() {
    this.container.style.display = this.container.style.display === 'none' ? 'flex' : 'none';
  },

  // Add problem item
  addProblem(line, message, severity = 'error') {
    const panel = document.getElementById('problems-panel');
    if (panel.querySelector('.empty-state')) {
      panel.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'problem-item';
    item.innerHTML = `
      <div class="problem-icon">${severity === 'error' ? '❌' : '⚠️'}</div>
      <div>
        <div class="problem-text">${message}</div>
        <div class="problem-line">Line ${line}</div>
      </div>
    `;
    panel.appendChild(item);

    // Auto-show problems tab
    this.switchTab('problems');
  },

  clearProblems() {
    const panel = document.getElementById('problems-panel');
    panel.innerHTML = '<div class="empty-state">No problems detected</div>';
  },

  // Queue management
  addToQueue(narrationText) {
    const panel = document.getElementById('queue-panel');
    if (panel.querySelector('.empty-state')) {
      panel.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'problem-item';
    item.style.borderLeftColor = 'var(--accent-primary)';
    item.innerHTML = `
      <div class="problem-icon">⏳</div>
      <div class="problem-text">${narrationText.substring(0, 100)}...</div>
    `;
    panel.appendChild(item);
  },

  clearQueue() {
    const panel = document.getElementById('queue-panel');
    panel.innerHTML = '<div class="empty-state">Narration queue is empty</div>';
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bottomPanel.init());
} else {
  bottomPanel.init();
}

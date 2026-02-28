/**
 * Command Palette - Cursor/Windsurf style (Ctrl+Shift+P)
 * Quick access to commands, narrator controls, file operations
 */

const commandPalette = {
  element: document.getElementById('commandPalette'),
  input: document.getElementById('commandInput'),
  list: document.getElementById('commandList'),
  isOpen: false,
  selectedIndex: 0,

  commands: [
    {
      id: 'toggle-narration',
      label: 'Toggle Narration',
      shortcut: 'Ctrl+Shift+N',
      category: 'Narration',
      fn: () => {
        const toggle = document.getElementById('narrationEnabled');
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
      }
    },
    {
      id: 'next-persona',
      label: 'Next Persona',
      shortcut: 'Ctrl+Alt+P',
      category: 'Narration',
      fn: () => {
        const select = document.getElementById('personaSelect');
        const options = select.querySelectorAll('option');
        const current = Array.from(options).findIndex(o => o.value === select.value);
        const next = (current + 1) % options.length;
        select.value = options[next].value;
        select.dispatchEvent(new Event('change'));
      }
    },
    {
      id: 'next-tone',
      label: 'Next Tone',
      shortcut: 'Ctrl+Alt+T',
      category: 'Narration',
      fn: () => {
        const select = document.getElementById('toneSelect');
        const options = select.querySelectorAll('option');
        const current = Array.from(options).findIndex(o => o.value === select.value);
        const next = (current + 1) % options.length;
        select.value = options[next].value;
        select.dispatchEvent(new Event('change'));
      }
    },
    {
      id: 'narrate-selection',
      label: 'Narrate Selection',
      shortcut: 'Ctrl+Shift+E',
      category: 'Narration',
      fn: () => {
        console.log('Narrate selection');
      }
    },
    {
      id: 'clear-history',
      label: 'Clear Narration History',
      shortcut: '',
      category: 'History',
      fn: () => {
        document.getElementById('narrationHistory').innerHTML = '<div class="empty-state">No narrations yet</div>';
      }
    },
    {
      id: 'pin-last-narration',
      label: 'Pin Last Narration',
      shortcut: '',
      category: 'History',
      fn: () => {
        console.log('Pin last narration');
      }
    },
    {
      id: 'export-history',
      label: 'Export History as Markdown',
      shortcut: '',
      category: 'History',
      fn: () => {
        console.log('Export history');
      }
    },
    {
      id: 'open-settings',
      label: 'Open Settings',
      shortcut: 'Ctrl+,',
      category: 'Editor',
      fn: () => {
        // Trigger settings modal
      }
    },
    {
      id: 'toggle-sidebar-left',
      label: 'Toggle Left Sidebar',
      shortcut: 'Ctrl+B',
      category: 'Editor',
      fn: () => {
        const sidebar = document.getElementById('sidebarLeft');
        sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
      }
    },
    {
      id: 'toggle-sidebar-right',
      label: 'Toggle Right Sidebar',
      shortcut: 'Ctrl+Shift+G',
      category: 'Editor',
      fn: () => {
        const sidebar = document.getElementById('sidebarRight');
        sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
      }
    },
    {
      id: 'toggle-bottom-panel',
      label: 'Toggle Bottom Panel',
      shortcut: 'Ctrl+J',
      category: 'Editor',
      fn: () => {
        const panel = document.getElementById('bottomPanel');
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      }
    },
    {
      id: 'focus-editor',
      label: 'Focus Editor',
      shortcut: 'Ctrl+E',
      category: 'Editor',
      fn: () => {
        document.getElementById('editor').focus();
      }
    },
    {
      id: 'help',
      label: 'Show Help',
      shortcut: '?',
      category: 'Help',
      fn: () => {
        console.log('Show help');
      }
    }
  ],

  init() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+P to open
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        this.toggle();
      }
      // Escape to close
      if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }
      // Arrow keys to navigate
      if (this.isOpen) {
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          this.selectNext();
        }
        if (e.code === 'ArrowUp') {
          e.preventDefault();
          this.selectPrev();
        }
        if (e.code === 'Enter') {
          e.preventDefault();
          this.executeSelected();
        }
      }
    });

    // Command button in top bar
    document.getElementById('commandBtn').addEventListener('click', () => this.toggle());

    // Input filter
    this.input.addEventListener('input', () => this.render());

    // Click outside to close
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close();
    });
  },

  toggle() {
    this.isOpen ? this.close() : this.open();
  },

  open() {
    this.isOpen = true;
    this.element.classList.add('active');
    this.input.focus();
    this.input.value = '';
    this.selectedIndex = 0;
    this.render();
  },

  close() {
    this.isOpen = false;
    this.element.classList.remove('active');
  },

  render() {
    const query = this.input.value.toLowerCase();
    const filtered = this.commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );

    this.list.innerHTML = filtered.map((cmd, idx) => `
      <button class="command-item ${idx === this.selectedIndex ? 'selected' : ''}" data-id="${cmd.id}">
        <span class="command-icon">${this.getCategoryIcon(cmd.category)}</span>
        <span class="command-label">
          <div>${cmd.label}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${cmd.category}</div>
        </span>
        ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
      </button>
    `).join('');

    // Click handlers
    this.list.querySelectorAll('.command-item').forEach((el, idx) => {
      el.addEventListener('click', () => {
        this.selectedIndex = idx;
        this.executeSelected();
      });
      el.addEventListener('mouseenter', () => {
        this.selectedIndex = idx;
        this.updateSelection();
      });
    });
  },

  getCategoryIcon(category) {
    const icons = {
      'Narration': '🎙️',
      'History': '📚',
      'Editor': '✏️',
      'Help': '❓'
    };
    return icons[category] || '•';
  },

  selectNext() {
    const query = this.input.value.toLowerCase();
    const filtered = this.commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );
    this.selectedIndex = (this.selectedIndex + 1) % filtered.length;
    this.updateSelection();
  },

  selectPrev() {
    const query = this.input.value.toLowerCase();
    const filtered = this.commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );
    this.selectedIndex = (this.selectedIndex - 1 + filtered.length) % filtered.length;
    this.updateSelection();
  },

  updateSelection() {
    this.list.querySelectorAll('.command-item').forEach((el, idx) => {
      el.classList.toggle('selected', idx === this.selectedIndex);
    });
  },

  executeSelected() {
    const query = this.input.value.toLowerCase();
    const filtered = this.commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );
    if (filtered[this.selectedIndex]) {
      filtered[this.selectedIndex].fn();
      this.close();
    }
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => commandPalette.init());
} else {
  commandPalette.init();
}

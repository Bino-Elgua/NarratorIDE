/**
 * VibeApp — Main frontend controller for the Vibe Coder UI.
 * Manages Monaco editor, terminal, WebSocket, narration panel, and audio sync.
 */

import { AudioQueue } from './audio/audio-queue.js';

export class VibeApp {
  constructor() {
    this.socket = null;
    this.editor = null;
    this.terminal = null;
    this.fitAddon = null;
    this.audioQueue = new AudioQueue();
    this.openFiles = new Map();   // filepath -> { content, model }
    this.activeFile = null;
    this.isSessionActive = false;
    this.terminalSessionId = null;
  }

  async init() {
    await this._initMonaco();
    this._initTerminal();
    this._connectWebSocket();
    this._bindEvents();
    await this.audioQueue.init();
  }

  // ─── Monaco Editor ────────────────────────────────────────────────

  async _initMonaco() {
    return new Promise((resolve) => {
      require.config({
        paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' },
      });

      require(['vs/editor/editor.main'], () => {
        // Define vibe dark theme
        monaco.editor.defineTheme('vibe-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#0a0a0a',
            'editor.foreground': '#e0e0e0',
            'editorCursor.foreground': '#667eea',
            'editor.lineHighlightBackground': '#141414',
            'editorLineNumber.foreground': '#444',
            'editor.selectionBackground': '#667eea33',
          },
        });

        this.editor = monaco.editor.create(document.getElementById('monaco-container'), {
          value: '// Send a prompt to start building...\n',
          language: 'javascript',
          theme: 'vibe-dark',
          automaticLayout: true,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          renderWhitespace: 'selection',
          smoothScrolling: true,
          cursorSmoothCaretAnimation: 'on',
          cursorBlinking: 'smooth',
        });

        resolve();
      });
    });
  }

  // ─── Terminal ─────────────────────────────────────────────────────

  _initTerminal() {
    const container = document.getElementById('terminal-container');
    if (!container || typeof Terminal === 'undefined') return;

    this.terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#ccc',
        cursor: '#667eea',
        selectionBackground: 'rgba(102,126,234,0.3)',
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      scrollback: 5000,
    });

    this.fitAddon = new FitAddon.FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(container);
    this.fitAddon.fit();

    this.terminal.onData((data) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'terminal-input',
          sessionId: this.terminalSessionId,
          data,
        }));
      }
    });
  }

  _createTerminalSession() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.terminalSessionId = `term-${Date.now()}`;
    this.socket.send(JSON.stringify({
      type: 'terminal-create',
      sessionId: this.terminalSessionId,
      cols: this.terminal ? this.terminal.cols : 80,
      rows: this.terminal ? this.terminal.rows : 24,
    }));
  }

  // ─── WebSocket ────────────────────────────────────────────────────

  _connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('[Vibe] Connected');
      this._updateStatus('coder', 'idle');
      this._updateStatus('narrator', 'idle');
      this._createTerminalSession();
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (err) {
        console.error('[Vibe] bad message:', err);
      }
    };

    this.socket.onclose = () => {
      console.log('[Vibe] Disconnected — reconnecting in 3s');
      this._updateStatus('coder', 'disconnected');
      setTimeout(() => this._connectWebSocket(), 3000);
    };
  }

  _handleMessage(msg) {
    switch (msg.type) {
      // ── Coder events ──
      case 'thinking':
        this._updateStatus('coder', 'thinking');
        this._addThought(msg.content, 'thinking');
        break;

      case 'code':
        this._updateStatus('coder', 'coding');
        this._streamCodeToEditor(msg.file, msg.content);
        break;

      case 'file-complete':
        this._saveFile(msg.file, msg.code);
        this._updateFileTree();
        break;

      // ── Narrator events ──
      case 'narration':
        this._updateStatus('narrator', 'speaking');
        this._addThought(msg.text, 'narration', msg.persona);
        this.audioQueue.add(msg.text, msg.audio, { priority: 'high' });
        break;

      case 'action-narration':
        this._addThought(msg.text, 'action');
        break;

      // ── Sync ──
      case 'sync-point':
        this.audioQueue.syncTo(msg.timestamp);
        break;

      // ── Session lifecycle ──
      case 'vibe-complete':
        this.isSessionActive = false;
        this._updateStatus('coder', 'idle');
        this._updateStatus('narrator', 'idle');
        this._addChatMessage('ai', 'Done! Your code is ready.');
        this._enablePrompt();
        break;

      case 'error':
        this.isSessionActive = false;
        this._addChatMessage('ai', `Error: ${msg.error || msg.content}`);
        this._enablePrompt();
        this._updateStatus('coder', 'idle');
        break;

      // ── Terminal ──
      case 'terminal-output':
        if (this.terminal) this.terminal.write(msg.data);
        break;

      case 'terminal-created':
        break;

      // ── File system ──
      case 'file-tree':
        this._renderFileTree(msg.data);
        break;

      case 'file-content':
        this._openFileInEditor(msg.path, msg.data);
        break;

      case 'file-changed':
        // External change — could refresh tree
        break;

      // ── Existing narrator events (legacy compat) ──
      case 'state':
      case 'thinking-chunk':
      case 'thinking-narration':
      case 'output-narration':
      case 'thinking-session-complete':
        break;
    }
  }

  // ─── Code Streaming ───────────────────────────────────────────────

  _streamCodeToEditor(filePath, codeChunk) {
    if (!filePath) filePath = 'untitled';

    // Track file
    if (!this.openFiles.has(filePath)) {
      this._createFileTab(filePath);
      this.openFiles.set(filePath, { content: '' });
    }

    const file = this.openFiles.get(filePath);
    file.content += codeChunk;

    // If active file, type it into the editor
    if (this.activeFile === filePath) {
      this._typewriterAppend(codeChunk);
    }
  }

  _typewriterAppend(text) {
    if (!this.editor) return;

    const model = this.editor.getModel();
    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);

    // Insert at end
    model.pushEditOperations([], [{
      range: {
        startLineNumber: lastLine,
        startColumn: lastCol,
        endLineNumber: lastLine,
        endColumn: lastCol,
      },
      text,
    }], () => null);

    // Scroll to bottom
    const newLastLine = model.getLineCount();
    this.editor.revealLine(newLastLine);
  }

  _saveFile(filePath, code) {
    this.openFiles.set(filePath, { content: code });

    // If this is the first file or active file, show it
    if (!this.activeFile || this.activeFile === filePath) {
      this._switchToFile(filePath);
    }
  }

  _switchToFile(filePath) {
    const file = this.openFiles.get(filePath);
    if (!file || !this.editor) return;

    this.activeFile = filePath;
    const lang = this._detectLanguage(filePath);
    const model = monaco.editor.createModel(file.content, lang);
    this.editor.setModel(model);

    // Update tab highlights
    document.querySelectorAll('.vibe-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.vibe-tab[data-file="${filePath}"]`);
    if (tab) tab.classList.add('active');

    document.getElementById('current-file').textContent = filePath;
  }

  _detectLanguage(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', rs: 'rust', go: 'go', c: 'c', java: 'java',
      html: 'html', css: 'css', json: 'json', md: 'markdown', sh: 'shell',
      yaml: 'yaml', yml: 'yaml', toml: 'ini', sql: 'sql',
    };
    return map[ext] || 'plaintext';
  }

  // ─── File Tree ────────────────────────────────────────────────────

  _createFileTab(filePath) {
    const tabs = document.getElementById('tabs');
    if (!tabs) return;

    // Don't duplicate
    if (document.querySelector(`.vibe-tab[data-file="${filePath}"]`)) return;

    const tab = document.createElement('div');
    tab.className = 'vibe-tab';
    tab.dataset.file = filePath;
    tab.textContent = filePath.split('/').pop();
    tab.addEventListener('click', () => this._switchToFile(filePath));

    tabs.appendChild(tab);

    // If first file, make it active
    if (!this.activeFile) {
      this.activeFile = filePath;
      tab.classList.add('active');
    }
  }

  _updateFileTree() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'editor-tree' }));
    }
  }

  _renderFileTree(tree) {
    const container = document.getElementById('file-tree');
    if (!container || !tree) return;

    container.innerHTML = '';
    this._renderTreeNode(tree, container, 0);
  }

  _renderTreeNode(node, parent, depth) {
    if (!node.children) {
      // File
      const item = document.createElement('div');
      item.className = 'vibe-file-item';
      item.style.paddingLeft = `${12 + depth * 16}px`;
      item.textContent = `📄 ${node.name}`;
      item.addEventListener('click', () => {
        // Request file content
        this.socket.send(JSON.stringify({ type: 'editor-open', path: node.path }));
      });
      parent.appendChild(item);
    } else {
      // Directory
      const item = document.createElement('div');
      item.className = 'vibe-file-item';
      item.style.paddingLeft = `${12 + depth * 16}px`;
      item.textContent = `📁 ${node.name}`;
      parent.appendChild(item);

      for (const child of node.children) {
        this._renderTreeNode(child, parent, depth + 1);
      }
    }
  }

  _openFileInEditor(filePath, data) {
    if (!data) return;
    this.openFiles.set(filePath, { content: data.content || '' });
    this._createFileTab(filePath);
    this._switchToFile(filePath);
  }

  // ─── Narration Panel ──────────────────────────────────────────────

  _addThought(text, kind, persona) {
    const panel = document.getElementById('narration-panel');
    if (!panel || !text) return;

    const bubble = document.createElement('div');

    if (kind === 'action') {
      bubble.className = 'vibe-thought-bubble vibe-action-bubble';
      bubble.innerHTML = `<span class="vibe-action-icon">⚡</span> ${this._escapeHtml(text)}`;
    } else {
      bubble.className = 'vibe-thought-bubble';
      if (kind === 'narration' && persona) {
        const tag = document.createElement('div');
        tag.className = 'vibe-thought-persona';
        tag.textContent = persona;
        bubble.appendChild(tag);
      }
      const content = document.createElement('div');
      content.textContent = text;
      bubble.appendChild(content);
    }

    panel.appendChild(bubble);
    panel.scrollTop = panel.scrollHeight;

    // Update header
    const header = document.getElementById('narration-status');
    if (header) {
      if (kind === 'narration') {
        header.className = 'vibe-narration-header speaking';
        header.textContent = 'Speaking...';
      } else if (kind === 'thinking') {
        header.textContent = 'AI Thinking...';
      }
    }
  }

  // ─── Chat ─────────────────────────────────────────────────────────

  _addChatMessage(role, text) {
    const history = document.getElementById('chat-history');
    if (!history) return;

    const msg = document.createElement('div');
    msg.className = `vibe-chat-message ${role}`;
    msg.textContent = text;
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
  }

  // ─── Prompt / Session ─────────────────────────────────────────────

  sendPrompt(prompt) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this._addChatMessage('ai', 'Not connected to server.');
      return;
    }

    if (this.isSessionActive) {
      this._addChatMessage('ai', 'A session is already running. Please wait.');
      return;
    }

    this._addChatMessage('user', prompt);
    this.isSessionActive = true;
    this._disablePrompt();

    // Clear editor for fresh session
    if (this.editor) {
      this.editor.getModel().setValue('');
    }
    this.openFiles.clear();
    this.activeFile = null;
    document.getElementById('tabs').innerHTML = '';

    // Clear narration
    const panel = document.getElementById('narration-panel');
    if (panel) {
      const header = panel.querySelector('.vibe-narration-header');
      panel.innerHTML = '';
      if (header) panel.appendChild(header);
    }

    this.socket.send(JSON.stringify({
      type: 'vibe-start',
      prompt,
      persona: document.getElementById('persona-select').value,
      context: {
        openFiles: Array.from(this.openFiles.keys()),
        currentFile: this.activeFile,
      },
    }));

    this._updateStatus('coder', 'thinking');
    this._updateStatus('narrator', 'ready');
  }

  _disablePrompt() {
    const btn = document.getElementById('send-btn');
    const input = document.getElementById('main-prompt');
    if (btn) { btn.disabled = true; btn.textContent = 'Building...'; }
    if (input) input.disabled = true;
  }

  _enablePrompt() {
    const btn = document.getElementById('send-btn');
    const input = document.getElementById('main-prompt');
    if (btn) { btn.disabled = false; btn.textContent = 'Build'; }
    if (input) input.disabled = false;
  }

  // ─── Status Bar ───────────────────────────────────────────────────

  _updateStatus(component, state) {
    const indicator = document.getElementById(`${component}-status`);
    const text = document.getElementById(`${component}-status-text`);
    if (!indicator || !text) return;

    indicator.className = 'vibe-status-indicator';

    const styles = {
      idle: '',
      disconnected: 'disconnected',
      thinking: 'thinking',
      coding: 'coding',
      speaking: 'speaking',
      ready: 'ready',
    };

    if (styles[state]) indicator.classList.add(styles[state]);

    const label = component === 'coder' ? 'Coder' : 'Narrator';
    const labels = {
      idle: `${label}: Idle`,
      disconnected: `${label}: Disconnected`,
      thinking: `${label}: Thinking...`,
      coding: `${label}: Writing code...`,
      speaking: `${label}: Speaking`,
      ready: `${label}: Ready`,
    };
    text.textContent = labels[state] || `${label}: ${state}`;
  }

  // ─── Events ───────────────────────────────────────────────────────

  _bindEvents() {
    // Main prompt
    const promptInput = document.getElementById('main-prompt');
    const sendBtn = document.getElementById('send-btn');

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const prompt = promptInput.value.trim();
        if (prompt) {
          this.sendPrompt(prompt);
          promptInput.value = '';
        }
      });
    }

    if (promptInput) {
      promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendBtn.click();
        }
      });
    }

    // Chat input
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send-btn');

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = chatInput.value.trim();
          if (text) {
            this.sendPrompt(text);
            chatInput.value = '';
          }
        }
      });
    }

    if (chatSend) {
      chatSend.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (text) {
          this.sendPrompt(text);
          chatInput.value = '';
        }
      });
    }

    // Clear terminal
    const clearTerm = document.getElementById('clear-terminal');
    if (clearTerm) {
      clearTerm.addEventListener('click', () => {
        if (this.terminal) this.terminal.clear();
      });
    }

    // Mute toggle
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const muted = this.audioQueue.toggleMute();
        muteBtn.textContent = muted ? '🔇' : '🔊';
      });
    }

    // Stop session
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'vibe-stop' }));
        }
        this.isSessionActive = false;
        this.audioQueue.stop();
        this._enablePrompt();
        this._updateStatus('coder', 'idle');
        this._updateStatus('narrator', 'idle');
      });
    }

    // Window resize
    window.addEventListener('resize', () => {
      if (this.fitAddon) this.fitAddon.fit();
    });
  }

  // ─── Util ─────────────────────────────────────────────────────────

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

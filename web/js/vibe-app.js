/**
 * Vibe App — Client-side WebSocket controller for NarratorIDE Vibe Coder.
 * Connects to the server at ws://localhost:3002, handles all WS event types,
 * streams code into Monaco Editor, and displays narration/status in the UI.
 */

export class VibeApp {
  constructor() {
    this.ws = null;
    this.editor = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.isMuted = false;
    this.sessionActive = false;
    this.openFiles = new Map();   // path → model
    this.activeFile = null;

    // DOM handles (resolved in init)
    this.dom = {};
  }

  // ─── Bootstrap ──────────────────────────────────────────────────

  async init() {
    this._cacheDom();
    this._bindUI();
    await this._initMonaco();
    this._connectWebSocket();
  }

  _cacheDom() {
    this.dom = {
      narrationPanel:   document.getElementById('narration-panel'),
      narrationStatus:  document.getElementById('narration-status'),
      chatHistory:      document.getElementById('chat-history'),
      fileTree:         document.getElementById('file-tree'),
      coderStatus:      document.getElementById('coder-status'),
      coderStatusText:  document.getElementById('coder-status-text'),
      narratorStatus:   document.getElementById('narrator-status'),
      narratorStatusText: document.getElementById('narrator-status-text'),
      currentFile:      document.getElementById('current-file'),
      prompt:           document.getElementById('main-prompt'),
      sendBtn:          document.getElementById('send-btn'),
      stopBtn:          document.getElementById('stop-btn'),
      muteBtn:          document.getElementById('mute-btn'),
      personaSelect:    document.getElementById('persona-select'),
      chatInput:        document.getElementById('chat-input'),
      chatSendBtn:      document.getElementById('chat-send-btn'),
      tabs:             document.getElementById('tabs'),
    };
  }

  _bindUI() {
    // Build button
    this.dom.sendBtn.addEventListener('click', () => this._startSession());
    this.dom.prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._startSession(); }
    });

    // Stop button
    this.dom.stopBtn.addEventListener('click', () => this._stopSession());

    // Mute toggle
    this.dom.muteBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      this.dom.muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
    });

    // Chat send
    this.dom.chatSendBtn.addEventListener('click', () => this._sendChat());
    this.dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendChat(); }
    });
  }

  // ─── Monaco Editor ─────────────────────────────────────────────

  _initMonaco() {
    return new Promise((resolve) => {
      require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
      require(['vs/editor/editor.main'], () => {
        this.editor = monaco.editor.create(document.getElementById('monaco-container'), {
          value: '// Vibe Coder — describe what you want to build\n',
          language: 'javascript',
          theme: 'vs-dark',
          fontSize: 14,
          minimap: { enabled: false },
          automaticLayout: true,
          readOnly: false,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
        });
        resolve();
      });
    });
  }

  // ─── WebSocket ─────────────────────────────────────────────────

  _connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${location.hostname}:3002`;

    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      this._setCoderStatus('ready', 'Coder: Ready');
      this._setNarratorStatus('ready', 'Narrator: Ready');
      this._addNarrationBubble('system', 'Connected to NarratorIDE server.');
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch { /* ignore malformed frames */ }
    });

    this.ws.addEventListener('close', () => {
      this._setCoderStatus('disconnected', 'Coder: Disconnected');
      this._setNarratorStatus('disconnected', 'Narrator: Disconnected');
      this._addNarrationBubble('system', 'Disconnected. Reconnecting…');
      setTimeout(() => this._connectWebSocket(), 3000);
    });

    this.ws.addEventListener('error', () => {
      this._setCoderStatus('disconnected', 'Coder: Error');
    });
  }

  _send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ─── Message Router ────────────────────────────────────────────

  _handleMessage(msg) {
    switch (msg.type) {
      // ── Session lifecycle ──
      case 'session-start':
        this.sessionActive = true;
        this._setCoderStatus('coding', 'Coder: Active');
        break;

      case 'session-end':
      case 'vibe-complete':
        this.sessionActive = false;
        this._setCoderStatus('ready', 'Coder: Done');
        this._setNarratorStatus('ready', 'Narrator: Idle');
        this._addNarrationBubble('system', 'Session complete.');
        this._setUIBusy(false);
        break;

      // ── Narration ──
      case 'narration':
        this._onNarration(msg);
        break;

      case 'thinking-narration':
      case 'action-narration':
      case 'output-narration':
        this._onNarration(msg.data || msg);
        break;

      // ── Code streaming ──
      case 'code':
        this._onCodeChunk(msg);
        break;

      case 'file-complete':
        this._onFileComplete(msg);
        break;

      // ── Thinking ──
      case 'thinking':
      case 'thinking-chunk':
        this._onThinking(msg);
        break;

      // ── File system ──
      case 'file-tree':
        this._renderFileTree(msg.data);
        break;

      case 'file-content':
        this._openFileInEditor(msg.path, msg.data);
        break;

      case 'file-created':
        this._onFileCreated(msg.data || msg);
        break;

      case 'file-changed':
        this._onFileChanged(msg.data);
        break;

      case 'file-write':
        this._onFileChanged(msg.data || msg);
        break;

      // ── State ──
      case 'state':
        this._onState(msg.data);
        break;

      // ── Errors ──
      case 'error':
        this._addNarrationBubble('error', msg.error || msg.content || 'Unknown error');
        this._setUIBusy(false);
        break;

      // ── Persona / tone changes ──
      case 'persona-changed':
      case 'tone-changed':
        break; // ack, no UI action needed

      default:
        break;
    }
  }

  // ─── Session Control ───────────────────────────────────────────

  _startSession() {
    const prompt = this.dom.prompt.value.trim();
    if (!prompt) return;

    this._addChatMessage('user', prompt);
    this._setUIBusy(true);
    this._setCoderStatus('thinking', 'Coder: Thinking…');
    this._setNarratorStatus('ready', 'Narrator: Waiting…');

    this._send({
      type: 'vibe-start',
      prompt,
      persona: this.dom.personaSelect.value,
      enableAudio: !this.isMuted,
      context: {},
    });
  }

  _stopSession() {
    this._send({ type: 'vibe-stop' });
    this.sessionActive = false;
    this._setUIBusy(false);
    this._setCoderStatus('ready', 'Coder: Stopped');
    this._addNarrationBubble('system', 'Session stopped by user.');
  }

  _sendChat() {
    const text = this.dom.chatInput.value.trim();
    if (!text) return;
    this.dom.chatInput.value = '';
    this._addChatMessage('user', text);

    // If a session is active, treat as follow-up prompt; otherwise start new
    if (this.sessionActive) {
      this._send({ type: 'vibe-start', prompt: text, persona: this.dom.personaSelect.value, enableAudio: !this.isMuted });
    } else {
      this.dom.prompt.value = text;
      this._startSession();
    }
  }

  _setUIBusy(busy) {
    this.dom.sendBtn.disabled = busy;
    this.dom.prompt.disabled = busy;
    this.dom.sendBtn.textContent = busy ? 'Building…' : 'Build';
  }

  // ─── Narration ─────────────────────────────────────────────────

  _onNarration(msg) {
    const text = msg.text || msg.content || '';
    if (!text) return;

    this._setNarratorStatus('speaking', 'Narrator: Speaking');
    this._addNarrationBubble('narration', text, msg.persona);
    this._addChatMessage('ai', text);

    if (msg.audio && !this.isMuted) {
      this._playAudio(msg.audio);
    }

    // Reset narrator status after a short delay
    setTimeout(() => {
      if (!this.sessionActive) this._setNarratorStatus('ready', 'Narrator: Idle');
    }, 3000);
  }

  _onThinking(msg) {
    const text = msg.content || (msg.data && msg.data.content) || '';
    if (!text) return;
    this._setCoderStatus('thinking', 'Coder: Thinking…');
    this._addNarrationBubble('thinking', text);
  }

  // ─── Code Chunks → Monaco ─────────────────────────────────────

  _onCodeChunk(msg) {
    const file = msg.file || 'untitled';
    const content = msg.content || '';

    this._setCoderStatus('coding', `Coder: Writing ${file}`);
    if (this.dom.currentFile) this.dom.currentFile.textContent = file;

    // Get or create a model for this file
    let model = this.openFiles.get(file);
    if (!model) {
      const lang = this._guessLanguage(file);
      model = monaco.editor.createModel('', lang);
      this.openFiles.set(file, model);
      this._addTab(file);
    }

    // Append the chunk to the model
    const lineCount = model.getLineCount();
    const lastLineLength = model.getLineMaxColumn(lineCount);
    const range = new monaco.Range(lineCount, lastLineLength, lineCount, lastLineLength);
    model.applyEdits([{ range, text: content }]);

    // Switch editor to this file if different
    if (this.activeFile !== file) {
      this.editor.setModel(model);
      this.activeFile = file;
      this._activateTab(file);
    }

    // Scroll to bottom
    const newLineCount = model.getLineCount();
    this.editor.revealLine(newLineCount);
  }

  _onFileComplete(msg) {
    const file = msg.file;
    const code = msg.code || '';

    // Ensure model has the final complete content
    let model = this.openFiles.get(file);
    if (!model) {
      const lang = this._guessLanguage(file);
      model = monaco.editor.createModel(code, lang);
      this.openFiles.set(file, model);
      this._addTab(file);
    } else {
      model.setValue(code);
    }

    this._addNarrationBubble('action', `✅ File written: ${file}`);
    this._refreshFileTree();
  }

  // ─── File System ───────────────────────────────────────────────

  _onFileCreated(data) {
    if (data && data.path) {
      this._addNarrationBubble('action', `📁 Created: ${data.path} (${data.size || 0} bytes)`);
    }
    this._refreshFileTree();
  }

  _onFileChanged(data) {
    if (data && data.path) {
      this._addNarrationBubble('action', `📄 File changed: ${data.path}`);
    }
    this._refreshFileTree();
  }

  _refreshFileTree() {
    this._send({ type: 'editor-tree' });
  }

  _renderFileTree(tree) {
    if (!tree || !Array.isArray(tree)) return;
    this.dom.fileTree.innerHTML = '';
    this._renderTreeNodes(tree, this.dom.fileTree, 0);
  }

  _renderTreeNodes(nodes, container, depth) {
    for (const node of nodes) {
      const el = document.createElement('div');
      el.className = 'vibe-file-item';
      el.style.paddingLeft = `${10 + depth * 14}px`;

      if (node.type === 'directory') {
        el.textContent = `📁 ${node.name}`;
        container.appendChild(el);
        if (node.children) this._renderTreeNodes(node.children, container, depth + 1);
      } else {
        el.textContent = `📄 ${node.name}`;
        el.addEventListener('click', () => {
          this._send({ type: 'editor-open', path: node.path });
        });
        container.appendChild(el);
      }
    }
  }

  _openFileInEditor(filePath, data) {
    const content = (data && data.content) || '';
    const lang = this._guessLanguage(filePath);

    let model = this.openFiles.get(filePath);
    if (model) {
      model.setValue(content);
    } else {
      model = monaco.editor.createModel(content, lang);
      this.openFiles.set(filePath, model);
      this._addTab(filePath);
    }

    this.editor.setModel(model);
    this.activeFile = filePath;
    this._activateTab(filePath);
    if (this.dom.currentFile) this.dom.currentFile.textContent = filePath;
  }

  _onState(state) {
    if (state && state.language && this.dom.personaSelect) {
      this.dom.personaSelect.value = state.language;
    }
  }

  // ─── Tabs ──────────────────────────────────────────────────────

  _addTab(file) {
    if (this.dom.tabs.querySelector(`[data-file="${file}"]`)) return;
    const tab = document.createElement('div');
    tab.className = 'vibe-tab';
    tab.dataset.file = file;
    tab.textContent = file.split('/').pop();
    tab.addEventListener('click', () => {
      const model = this.openFiles.get(file);
      if (model) {
        this.editor.setModel(model);
        this.activeFile = file;
        this._activateTab(file);
        if (this.dom.currentFile) this.dom.currentFile.textContent = file;
      }
    });
    this.dom.tabs.appendChild(tab);
  }

  _activateTab(file) {
    this.dom.tabs.querySelectorAll('.vibe-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.file === file);
    });
  }

  // ─── Narration Panel ───────────────────────────────────────────

  _addNarrationBubble(kind, text, persona) {
    const bubble = document.createElement('div');
    bubble.className = 'vibe-thought-bubble';

    if (kind === 'action') bubble.classList.add('vibe-action-bubble');
    if (kind === 'error') bubble.style.borderLeftColor = '#ef4444';
    if (kind === 'thinking') bubble.style.borderLeftColor = '#f59e0b';
    if (kind === 'system') bubble.style.borderLeftColor = '#10b981';

    if (persona) {
      const tag = document.createElement('div');
      tag.className = 'vibe-thought-persona';
      tag.textContent = persona;
      bubble.appendChild(tag);
    }

    const body = document.createElement('div');
    body.textContent = text;
    bubble.appendChild(body);

    this.dom.narrationPanel.appendChild(bubble);
    this.dom.narrationPanel.scrollTop = this.dom.narrationPanel.scrollHeight;
  }

  // ─── Chat History ──────────────────────────────────────────────

  _addChatMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `vibe-chat-message ${role}`;
    msg.textContent = text;
    this.dom.chatHistory.appendChild(msg);
    this.dom.chatHistory.scrollTop = this.dom.chatHistory.scrollHeight;
  }

  // ─── Status Indicators ─────────────────────────────────────────

  _setCoderStatus(state, label) {
    this.dom.coderStatus.className = `vibe-status-indicator ${state}`;
    if (this.dom.coderStatusText) this.dom.coderStatusText.textContent = label;
  }

  _setNarratorStatus(state, label) {
    this.dom.narratorStatus.className = `vibe-status-indicator ${state}`;
    if (this.dom.narratorStatusText) this.dom.narratorStatusText.textContent = label;
  }

  // ─── Audio ─────────────────────────────────────────────────────

  _playAudio(base64) {
    this.audioQueue.push(base64);
    if (!this.isPlaying) this._drainAudioQueue();
  }

  _drainAudioQueue() {
    if (this.audioQueue.length === 0) { this.isPlaying = false; return; }
    this.isPlaying = true;
    const data = this.audioQueue.shift();

    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
      this._drainAudioQueue();
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      this._drainAudioQueue();
    });
    audio.play().catch(() => this._drainAudioQueue());
  }

  // ─── Helpers ───────────────────────────────────────────────────

  _guessLanguage(filepath) {
    const ext = (filepath || '').split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
      c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', swift: 'swift',
      html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml',
      yml: 'yaml', md: 'markdown', sh: 'shell', bash: 'shell',
      sql: 'sql', xml: 'xml', toml: 'ini', dockerfile: 'dockerfile',
    };
    return map[ext] || 'plaintext';
  }
}

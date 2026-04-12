/**
 * Vibe App v2 — Multi-Agent Architecture
 * LEFT: File tree + Editor (IDE structure)
 * RIGHT: Multi-agent chat feed with persona-voiced narration
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
    this.agents = new Map();      // id → agent info
    this.currentAgent = null;

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
    this.dom.sendBtn.addEventListener('click', () => this._startSession());
    this.dom.prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._startSession(); }
    });

    this.dom.stopBtn.addEventListener('click', () => this._stopSession());

    this.dom.muteBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      this.dom.muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
    });

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
      this._addSystemMessage('Connected to NarratorIDE server.');
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
      this._addSystemMessage('Disconnected. Reconnecting…');
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
        this._addSystemMessage('Session complete.');
        this._setUIBusy(false);
        break;

      // ── Multi-Agent events (RIGHT PANEL) ──
      case 'agents-available':
        return this._setupAgents(msg.agents);

      case 'agent-switch':
        return this._switchAgent(msg.agent, msg.persona);

      case 'agent-message':
        return this._addAgentMessage(msg.agent, msg.text, msg.audio);

      // ── Legacy narration (still supported) ──
      case 'narration':
      case 'thinking-narration':
      case 'output-narration':
        return this._onLegacyNarration(msg.data || msg);

      case 'action-narration':
        // Suppress — file actions go to the file tree, not chat
        break;

      // ── Code streaming (LEFT PANEL - Editor) ──
      case 'code':
        return this._onCodeChunk(msg);

      case 'file-start':
        this._setCoderStatus('coding', `Coder: Creating ${msg.file}`);
        if (this.dom.currentFile) this.dom.currentFile.textContent = msg.file;
        break;

      case 'file-complete':
        return this._onFileComplete(msg);

      // ── Thinking (suppressed from chat — narrator handles it) ──
      case 'thinking':
      case 'thinking-chunk':
        this._setCoderStatus('thinking', 'Coder: Thinking…');
        break;

      // ── File system (LEFT PANEL - Tree) ──
      case 'file-tree':
        return this._renderFileTree(msg.data);

      case 'file-content':
        return this._openFileInEditor(msg.path, msg.data);

      case 'file-created':
      case 'file-changed':
        // Just refresh tree — NO chat bubbles for file events
        return this._refreshFileTree();

      // ── State ──
      case 'state':
        return this._onState(msg.data);

      // ── Errors ──
      case 'error':
        this._addSystemMessage(`❌ ${msg.error || msg.content || 'Unknown error'}`);
        this._setUIBusy(false);
        break;

      case 'persona-changed':
      case 'tone-changed':
        break;

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
    this._addSystemMessage('Session stopped by user.');
  }

  _sendChat() {
    const text = this.dom.chatInput.value.trim();
    if (!text) return;
    this.dom.chatInput.value = '';
    this._addChatMessage('user', text);

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

  // ─── Multi-Agent Chat (RIGHT PANEL) ────────────────────────────

  _setupAgents(agents) {
    if (!agents) return;
    agents.forEach(agent => this.agents.set(agent.id, agent));
  }

  _switchAgent(agentId, persona) {
    this.currentAgent = agentId;
    if (this.dom.narrationStatus && persona) {
      this.dom.narrationStatus.innerHTML = `${persona.icon} <span style="color:${persona.color}">${persona.displayName}</span> is coding…`;
    }
  }

  _addAgentMessage(agent, text, audioBase64) {
    if (!agent || !text) return;
    const chatHistory = this.dom.chatHistory;

    this._setNarratorStatus('speaking', `${agent.name}: Speaking`);

    const msgEl = document.createElement('div');
    msgEl.className = 'agent-message';
    msgEl.style.borderLeft = `3px solid ${agent.color}`;

    const header = document.createElement('div');
    header.className = 'agent-header';
    header.innerHTML = `
      <span class="agent-icon">${agent.icon}</span>
      <span class="agent-name" style="color:${agent.color}">${agent.displayName}</span>
      <span class="agent-time">${new Date().toLocaleTimeString()}</span>
    `;

    const body = document.createElement('div');
    body.className = 'agent-text';
    body.textContent = text;

    msgEl.appendChild(header);
    msgEl.appendChild(body);
    chatHistory.appendChild(msgEl);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Play audio
    if (audioBase64 && !this.isMuted) {
      this._playAudio(audioBase64);
    } else if (!this.isMuted) {
      this._speakWithAgentVoice(text, agent.id);
    }

    setTimeout(() => {
      if (!this.sessionActive) this._setNarratorStatus('ready', 'Narrator: Idle');
    }, 3000);
  }

  _onLegacyNarration(msg) {
    const text = msg.text || msg.content || '';
    if (!text) return;

    this._setNarratorStatus('speaking', 'Narrator: Speaking');

    // Show as generic agent message
    const persona = msg.persona || 'javascript';
    const agentInfo = this.agents.get(persona) || {
      icon: '🤖', name: 'AI', displayName: 'AI Assistant', color: '#667eea'
    };

    this._addAgentMessage(
      { id: persona, ...agentInfo },
      text,
      msg.audio
    );
  }

  _addSystemMessage(text) {
    const chatHistory = this.dom.chatHistory;
    const msgEl = document.createElement('div');
    msgEl.className = 'system-message';
    msgEl.textContent = text;
    chatHistory.appendChild(msgEl);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // ─── Code Chunks → Monaco (LEFT PANEL) ────────────────────────

  _onCodeChunk(msg) {
    const file = msg.file || 'untitled';
    const content = msg.content || '';

    this._setCoderStatus('coding', `Coder: Writing ${file}`);
    if (this.dom.currentFile) this.dom.currentFile.textContent = file;

    let model = this.openFiles.get(file);
    if (!model) {
      const lang = this._guessLanguage(file);
      model = monaco.editor.createModel('', lang);
      this.openFiles.set(file, model);
      this._addTab(file);
    }

    const lineCount = model.getLineCount();
    const lastLineLength = model.getLineMaxColumn(lineCount);
    const range = new monaco.Range(lineCount, lastLineLength, lineCount, lastLineLength);
    model.applyEdits([{ range, text: content }]);

    if (this.activeFile !== file) {
      this.editor.setModel(model);
      this.activeFile = file;
      this._activateTab(file);
    }

    const newLineCount = model.getLineCount();
    this.editor.revealLine(newLineCount);
  }

  _onFileComplete(msg) {
    const file = msg.file;
    const code = msg.code || '';

    let model = this.openFiles.get(file);
    if (!model) {
      const lang = this._guessLanguage(file);
      model = monaco.editor.createModel(code, lang);
      this.openFiles.set(file, model);
      this._addTab(file);
    } else {
      model.setValue(code);
    }

    // NO narration bubble — file tree handles this
    this._refreshFileTree();
  }

  // ─── File System (LEFT PANEL) ──────────────────────────────────

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
        el.innerHTML = `<span class="tree-icon">📁</span> ${this._escapeHtml(node.name)}`;
        container.appendChild(el);
        if (node.children) this._renderTreeNodes(node.children, container, depth + 1);
      } else {
        const icon = this._getFileIcon(node.name);
        el.innerHTML = `<span class="tree-icon">${icon}</span> ${this._escapeHtml(node.name)}`;
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

  // ─── Chat Panel (RIGHT PANEL) ─────────────────────────────────

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

  _speakWithAgentVoice(text, agentId) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);

    switch (agentId) {
      case 'javascript': utterance.rate = 1.3; utterance.pitch = 1.1; break;
      case 'rust':       utterance.rate = 0.9; utterance.pitch = 0.95; break;
      case 'python':     utterance.rate = 1.1; utterance.pitch = 1.0; break;
      case 'go':         utterance.rate = 1.2; utterance.pitch = 1.0; break;
      case 'c':          utterance.rate = 0.85; utterance.pitch = 0.9; break;
      case 'java':       utterance.rate = 1.0; utterance.pitch = 0.95; break;
      case 'lisp':       utterance.rate = 0.8; utterance.pitch = 1.05; break;
      default:           utterance.rate = 1.0; utterance.pitch = 1.0;
    }

    window.speechSynthesis.speak(utterance);
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

  _getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const icons = {
      js: '⚡', jsx: '⚛️', ts: '🔷', tsx: '🔷',
      py: '🐍', rs: '🦀', go: '🐹', java: '☕',
      c: '🔧', cpp: '🔧', h: '📎',
      html: '🌐', css: '🎨', scss: '🎨',
      json: '📋', yaml: '📋', yml: '📋',
      md: '📝', sh: '💻', bash: '💻',
      sql: '🗃️', xml: '📄', toml: '⚙️',
    };
    return icons[ext] || '📄';
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

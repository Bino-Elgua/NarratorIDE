/**
 * Narrator IDE - Modern Edition App Logic
 * Handles editor initialization, WebSocket, narration, persona/tone management
 */

const app = {
  editor: null,
  ws: null,
  currentPersona: 'javascript',
  currentTone: 'playful',
  personas: {},
  tones: {},
  narrationEnabled: true,
  narrationHistory: [],
  personas_list: ['rust', 'go', 'python', 'javascript', 'c', 'java', 'lisp', 'typescript'],
  tones_list: ['academic', 'casual', 'playful', 'verbose', 'concise', 'encouraging', 'brutal'],
  terminal: null,
  sessionId: Math.random().toString(36).substring(7),

  // Persona avatars & emojis
  personaEmojis: {
    rust: '⚙️', go: '🚀', python: '🐍', javascript: '⚡',
    c: '💎', java: '☕', lisp: '🧠', typescript: '📘'
  },

  // Persona descriptions
  personaDescriptions: {
    rust: 'The Meticulous Engineer - safety-obsessed, pedantic',
    go: 'The Pragmatist - fast, direct, no-nonsense',
    python: 'The Gen-Z Creative - expressive, accessible, enthusiastic',
    javascript: 'The Chaos Agent - fast, opinionated, irreverent',
    c: 'The Elder Craftsman - wise, careful, grim',
    java: 'The Corporate Consultant - formal, enterprise-minded',
    lisp: 'The Philosopher - meditative, abstract, contemplative',
    typescript: 'The Careful Editor - methodical, reassuring, precise'
  },

  async init() {
    console.log('🎙️ Initializing Narrator IDE Modern...');

    // Initialize Monaco Editor
    await this.initEditor();

    // Load personas and tones
    await this.loadPersonas();
    await this.loadTones();

    // Setup UI
    this.setupControls();
    this.setupKeyboardShortcuts();

    // Connect WebSocket
    this.connectWebSocket();

    // Update persona indicator
    this.updatePersonaIndicator();

    console.log('✅ Narrator IDE ready!');
  },

  async initEditor() {
    return new Promise((resolve) => {
      require(['vs/editor/editor.main'], () => {
        this.editor = monaco.editor.create(document.getElementById('editor'), {
          value: `// Narrator IDE - Modern Edition\n// Start typing to get AI narration\n\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n`,
          language: 'javascript',
          theme: 'vs-dark',
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          fontSize: 13,
          fontFamily: 'Fira Code, Monaco, monospace',
          lineHeight: 1.6,
          smoothScrolling: true,
          cursorBlinking: 'expand',
          formatOnPaste: false,
          formatOnType: false,
        });

        // Update editor position display
        this.editor.onDidChangeCursorPosition((e) => {
          const pos = e.position;
          document.getElementById('editorPos').textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
        });

        // Track code changes for narration
        this.editor.onDidChangeModelContent(() => {
          this.onCodeChanged();
        });

        // Trigger narration on idle (after 500ms of typing)
        let narrationTimeout;
        this.editor.onDidChangeModelContent(() => {
          clearTimeout(narrationTimeout);
          narrationTimeout = setTimeout(() => this.triggerNarration(), 500);
        });

        resolve();
      });
    });
  },

  async loadPersonas() {
    try {
      const res = await fetch('/api/personas');
      this.personas = await res.json();
    } catch (e) {
      console.error('Failed to load personas:', e);
      // Use defaults
      this.personas = this.personas_list.reduce((acc, p) => {
        acc[p] = { name: p, description: this.personaDescriptions[p] };
        return acc;
      }, {});
    }

    // Populate selector
    const select = document.getElementById('personaSelect');
    select.innerHTML = Object.entries(this.personas).map(([key, val]) => `
      <option value="${key}">${val.name || key}</option>
    `).join('');

    select.value = this.currentPersona;
    select.addEventListener('change', (e) => {
      this.currentPersona = e.target.value;
      this.updatePersonaIndicator();
      this.showPersonaDescription();
    });

    this.showPersonaDescription();
  },

  async loadTones() {
    try {
      const res = await fetch('/api/tones');
      this.tones = await res.json();
    } catch (e) {
      console.error('Failed to load tones:', e);
      // Use defaults
      this.tones = {
        academic: 'Formal, research-oriented, technical depth',
        casual: 'Conversational, friendly, approachable',
        playful: 'Fun, humorous, entertaining',
        verbose: 'Detailed explanations, comprehensive',
        concise: 'Brief, to-the-point, efficient',
        encouraging: 'Positive, supportive, motivational',
        brutal: 'Honest criticism, blunt, unfiltered'
      };
    }

    // Populate selector
    const select = document.getElementById('toneSelect');
    select.innerHTML = Object.entries(this.tones).map(([key, desc]) => `
      <option value="${key}">${key.charAt(0).toUpperCase() + key.slice(1)}</option>
    `).join('');

    select.value = this.currentTone;
    select.addEventListener('change', (e) => {
      this.currentTone = e.target.value;
      this.showToneDescription();
    });

    this.showToneDescription();
  },

  setupControls() {
    // Narration toggle
    document.getElementById('narrationEnabled').addEventListener('change', (e) => {
      this.narrationEnabled = e.target.checked;
      document.getElementById('narrationStatusText').textContent = e.target.checked ? 'Enabled' : 'Disabled';
    });

    // Narration button
    document.getElementById('narrationToggle').addEventListener('click', () => {
      const toggle = document.getElementById('narrationEnabled');
      toggle.checked = !toggle.checked;
      toggle.dispatchEvent(new Event('change'));
    });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+N: Toggle narration
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyN') {
        e.preventDefault();
        document.getElementById('narrationToggle').click();
      }
      // Ctrl+Alt+P: Next persona
      if (e.ctrlKey && e.altKey && e.code === 'KeyP') {
        e.preventDefault();
        this.nextPersona();
      }
      // Ctrl+Alt+T: Next tone
      if (e.ctrlKey && e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        this.nextTone();
      }
    });
  },

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      document.getElementById('statusDot').classList.add('connected');
      document.getElementById('connectionStatus').textContent = 'Connected';
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'narration') {
        this.displayNarration(data.data);
      }
    };

    this.ws.onerror = () => {
      console.error('❌ WebSocket error');
      document.getElementById('statusDot').classList.remove('connected');
      document.getElementById('connectionStatus').textContent = 'Error';
    };

    this.ws.onclose = () => {
      console.log('❌ WebSocket disconnected');
      document.getElementById('statusDot').classList.remove('connected');
      document.getElementById('connectionStatus').textContent = 'Disconnected';
    };
  },

  async triggerNarration() {
    if (!this.narrationEnabled || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const code = this.editor.getValue();
    const startTime = performance.now();

    // Show thinking indicator
    this.showThinking(true);

    this.ws.send(JSON.stringify({
      type: 'narrate',
      code: code,
      language: 'javascript',
      persona: this.currentPersona,
      tone: this.currentTone,
      filename: 'code.js'
    }));

    // Store timing
    setTimeout(() => {
      const responseTime = Math.round(performance.now() - startTime);
      document.getElementById('responseTime').textContent = `${responseTime}ms`;
      document.getElementById('lastNarrated').textContent = new Date().toLocaleTimeString();
    }, 100);
  },

  showThinking(show) {
    const status = document.getElementById('thinkingStatus');
    if (status) {
      status.style.display = show ? 'inline-flex' : 'none';
    }
  },

  displayNarration(narrationData) {
    // Hide thinking indicator
    this.showThinking(false);

    // Show in live panel with fade-in
    const livePanel = document.getElementById('liveNarration');
    livePanel.innerHTML = `<div class="narration-text">${narrationData.text}</div>`;
    livePanel.style.opacity = '0';
    
    setTimeout(() => {
      livePanel.style.transition = 'opacity 0.3s ease';
      livePanel.style.opacity = '1';
    }, 10);

    // Add to history
    this.addToHistory(narrationData);

    // Apply persona styling to root
    this.applyPersonaStyling(narrationData.persona);
  },

  applyPersonaStyling(persona) {
    document.documentElement.classList.remove(
      'persona-javascript', 'persona-python', 'persona-rust', 'persona-go',
      'persona-typescript', 'persona-java', 'persona-c', 'persona-lisp'
    );
    document.documentElement.classList.add(`persona-${persona}`);
  },

  addToHistory(data) {
    const historyContainer = document.getElementById('narrationHistory');
    
    if (historyContainer.querySelector('.empty-state')) {
      historyContainer.innerHTML = '';
    }

    const timestamp = new Date().toLocaleTimeString();
    const avatar = this.personaEmojis[data.persona] || '🎙️';

    const card = document.createElement('div');
    card.className = `narration-card glass-card`;
    card.innerHTML = `
      <div class="narration-card-header">
        <div class="narration-avatar" style="background: linear-gradient(135deg, var(--persona-accent, var(--accent-primary)), var(--accent-purple)); color: white;">${avatar}</div>
        <div class="narration-meta">
          <div class="narration-persona" style="color: var(--persona-accent, var(--accent-primary));">${data.persona}</div>
          <div class="narration-time">${timestamp}</div>
        </div>
      </div>
      <div class="narration-content">${data.text}</div>
      <div class="narration-actions">
        <button class="narration-btn" onclick="app.copyNarration(this)">📋 Copy</button>
        <button class="narration-btn" onclick="app.pinNarration(this)">📌 Pin</button>
      </div>
    `;

    historyContainer.insertBefore(card, historyContainer.firstChild);

    // Limit history to 30 items
    while (historyContainer.children.length > 30) {
      historyContainer.removeChild(historyContainer.lastChild);
    }
  },

  copyNarration(button) {
    const text = button.parentElement.previousElementSibling.textContent;
    navigator.clipboard.writeText(text);
    button.textContent = '✅ Copied!';
    setTimeout(() => {
      button.textContent = '📋 Copy';
    }, 2000);
  },

  pinNarration(button) {
    const text = button.parentElement.previousElementSibling.textContent;
    console.log('Pinned:', text);
    button.textContent = '📌 Pinned!';
    setTimeout(() => {
      button.textContent = '📌 Pin';
    }, 2000);
  },

  showPersonaDescription() {
    const desc = this.personas[this.currentPersona]?.description || '';
    document.getElementById('personaDescription').textContent = desc;
  },

  showToneDescription() {
    const desc = this.tones[this.currentTone] || '';
    document.getElementById('toneDescription').textContent = desc;
  },

  updatePersonaIndicator() {
    const indicator = document.getElementById('personaIndicator');
    const name = document.getElementById('personaName');
    const emoji = document.getElementById('personaEmoji');

    name.textContent = this.currentPersona.charAt(0).toUpperCase() + this.currentPersona.slice(1);
    emoji.textContent = this.personaEmojis[this.currentPersona] || '🎙️';
  },

  nextPersona() {
    const select = document.getElementById('personaSelect');
    const options = select.querySelectorAll('option');
    const current = Array.from(options).findIndex(o => o.value === select.value);
    const next = (current + 1) % options.length;
    select.value = options[next].value;
    select.dispatchEvent(new Event('change'));
  },

  nextTone() {
    const select = document.getElementById('toneSelect');
    const options = select.querySelectorAll('option');
    const current = Array.from(options).findIndex(o => o.value === select.value);
    const next = (current + 1) % options.length;
    select.value = options[next].value;
    select.dispatchEvent(new Event('change'));
  },

  onCodeChanged() {
    // Could add inline indicators here
    // e.g., highlight lines that triggered narration
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

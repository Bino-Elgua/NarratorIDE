/**
 * Narrator IDE - Main Application Logic
 * Handles editor initialization, state management, and event coordination
 */

// Global state
const appState = {
  persona: 'javascript',
  tone: 'casual',
  language: 'javascript',
  narrationEnabled: true,
  ttsEnabled: false,
  llmProvider: 'claude',
  editor: null,
  personas: [],
  tones: [],
  lastNarrationTime: null,
  lastResponseTime: null,
  narrationHistory: [],
};

// Initialize Monaco Editor
function initMonacoEditor() {
  return new Promise((resolve) => {
    require(['vs/editor/editor.main'], function () {
      const editor = monaco.editor.create(document.getElementById('editor'), {
        value: '// Welcome to Narrator IDE\n// Start typing code to see AI narration\n// The right panel will narrate your code with personalized voices\n\nconst greeting = "Hello, World!";\nconsole.log(greeting);',
        language: 'javascript',
        theme: 'vs-dark',
        minimap: { enabled: true },
        fontSize: 14,
        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
      });

      appState.editor = editor;

      // Auto-detect language on content change
      editor.onDidChangeModelContent(() => {
        clearTimeout(appState.languageDetectTimer);
        appState.languageDetectTimer = setTimeout(() => {
          detectLanguage();
          if (appState.narrationEnabled) {
            debounceNarration();
          }
        }, 500);
      });

      resolve(editor);
    });
  });
}

/**
 * Detect programming language from editor content
 */
function detectLanguage() {
  const content = appState.editor.getValue();
  const model = appState.editor.getModel();
  const detectedLang = model?.getLanguageId() || 'javascript';
  
  appState.language = detectedLang;
  
  // Update UI
  const detectedLangEl = document.getElementById('detectedLanguage');
  if (detectedLangEl) {
    detectedLangEl.textContent = detectedLang.toUpperCase();
  }
}

/**
 * Debounced narration trigger
 */
let narrationTimeout;
function debounceNarration() {
  clearTimeout(narrationTimeout);
  narrationTimeout = setTimeout(() => {
    triggerNarration();
  }, 800); // Wait for user to stop typing
}

/**
 * Trigger narration via WebSocket
 */
function triggerNarration() {
  if (!appState.narrationEnabled || !appState.editor) return;

  const code = appState.editor.getValue();
  if (!code || code.length < 10) return; // Ignore very short snippets

  const payload = {
    type: 'narrate',
    code: code,
    language: appState.language,
    persona: appState.persona,
    tone: appState.tone,
    timestamp: new Date().toISOString(),
  };

  const startTime = performance.now();

  // Send via WebSocket
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    window.ws.send(JSON.stringify(payload));
    
    // Track timing
    appState.lastNarrationRequestTime = startTime;
  } else {
    console.warn('WebSocket not connected');
  }
}

/**
 * Handle incoming narration from server
 */
function handleNarration(data) {
  if (appState.lastNarrationRequestTime) {
    const elapsed = performance.now() - appState.lastNarrationRequestTime;
    appState.lastResponseTime = Math.round(elapsed);
    updateMetrics();
  }

  // Update live narration panel
  const liveNarrationEl = document.getElementById('liveNarration');
  if (liveNarrationEl) {
    const narrationEl = document.createElement('div');
    narrationEl.className = `narration-text persona-${data.persona?.id || appState.persona}`;
    narrationEl.textContent = data.text;
    narrationEl.style.animation = 'none';
    narrationEl.offsetHeight; // Trigger reflow
    narrationEl.style.animation = 'fadeInUp 300ms ease';
    
    liveNarrationEl.innerHTML = '';
    liveNarrationEl.appendChild(narrationEl);
  }

  // Add to history
  addToHistory(data);

  // Play audio if available and TTS enabled
  if (data.audio && appState.ttsEnabled) {
    playAudio(data.audio);
  }

  // Update last narration time
  appState.lastNarrationTime = new Date();
  updateMetrics();
}

/**
 * Add narration to history panel
 */
function addToHistory(data) {
  appState.narrationHistory.unshift({
    ...data,
    timestamp: new Date(),
  });

  // Keep only last 50 items
  if (appState.narrationHistory.length > 50) {
    appState.narrationHistory.pop();
  }

  renderHistory();
}

/**
 * Render narration history
 */
function renderHistory() {
  const historyEl = document.getElementById('narrationHistory');
  if (!historyEl) return;

  if (appState.narrationHistory.length === 0) {
    historyEl.innerHTML = '<div class="empty-state">No narrations yet</div>';
    return;
  }

  historyEl.innerHTML = appState.narrationHistory
    .map((item, index) => {
      const time = new Date(item.timestamp);
      const timeStr = time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      });

      return `
        <div class="narration-item" onclick="replayNarration(${index})">
          <div class="narration-item-text">"${item.text}"</div>
          <div class="narration-item-meta">
            <span class="persona-badge">${item.persona?.name || 'Unknown'}</span>
            <span class="tone-badge">${item.tone || 'default'}</span>
            <span>${timeStr}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Replay narration from history
 */
function replayNarration(index) {
  const item = appState.narrationHistory[index];
  if (!item) return;

  // Update live narration
  const liveNarrationEl = document.getElementById('liveNarration');
  if (liveNarrationEl) {
    liveNarrationEl.innerHTML = `
      <div class="narration-text persona-${item.persona?.id || appState.persona}">
        "${item.text}"
      </div>
    `;
  }

  // Play audio if available
  if (item.audio && appState.ttsEnabled) {
    playAudio(item.audio);
  }
}

/**
 * Play audio from base64
 */
function playAudio(audioBase64) {
  try {
    const audioEl = document.getElementById('narrationAudio');
    if (!audioEl) return;

    const audioBlob = base64ToBlob(audioBase64, 'audio/mpeg');
    const audioUrl = URL.createObjectURL(audioBlob);
    audioEl.src = audioUrl;
    audioEl.play().catch(err => console.log('Audio play prevented:', err));
  } catch (error) {
    console.warn('Audio playback failed:', error);
  }
}

/**
 * Convert base64 to Blob
 */
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Update metrics display
 */
function updateMetrics() {
  // Last narrated
  const lastNarratedEl = document.getElementById('lastNarrated');
  if (lastNarratedEl && appState.lastNarrationTime) {
    const elapsed = Math.floor((Date.now() - appState.lastNarrationTime) / 1000);
    if (elapsed < 60) {
      lastNarratedEl.textContent = `${elapsed}s ago`;
    } else if (elapsed < 3600) {
      lastNarratedEl.textContent = `${Math.floor(elapsed / 60)}m ago`;
    } else {
      lastNarratedEl.textContent = appState.lastNarrationTime.toLocaleTimeString();
    }
  }

  // Response time
  const responseTimeEl = document.getElementById('responseTime');
  if (responseTimeEl && appState.lastResponseTime) {
    responseTimeEl.textContent = `${appState.lastResponseTime}ms`;
  }
}

/**
 * Update live metrics every second
 */
setInterval(() => {
  if (appState.lastNarrationTime) {
    updateMetrics();
  }
}, 1000);

/**
 * Load personas from server
 */
async function loadPersonas() {
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    window.ws.send(JSON.stringify({ type: 'get-personas' }));
  }
}

/**
 * Load tones from server
 */
async function loadTones() {
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    window.ws.send(JSON.stringify({ type: 'get-tones' }));
  }
}

/**
 * Set persona
 */
function setPersona(personaId) {
  appState.persona = personaId;
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    window.ws.send(JSON.stringify({ 
      type: 'set-persona', 
      language: personaId 
    }));
  }
  updatePersonaUI();
}

/**
 * Set tone
 */
function setTone(toneId) {
  appState.tone = toneId;
  if (window.ws && window.ws.readyState === WebSocket.OPEN) {
    window.ws.send(JSON.stringify({ 
      type: 'set-tone', 
      tone: toneId 
    }));
  }
  updateToneUI();
}

/**
 * Update persona selector UI
 */
function updatePersonaUI() {
  const select = document.getElementById('personaSelect');
  if (select) {
    select.value = appState.persona;
  }
  const descEl = document.getElementById('personaDescription');
  if (descEl && appState.personas.length > 0) {
    const persona = appState.personas.find(p => p.id === appState.persona);
    if (persona) {
      descEl.textContent = persona.description || '';
    }
  }
}

/**
 * Update tone selector UI
 */
function updateToneUI() {
  const select = document.getElementById('toneSelect');
  if (select) {
    select.value = appState.tone;
  }
  const descEl = document.getElementById('toneDescription');
  if (descEl && appState.tones.length > 0) {
    const tone = appState.tones.find(t => t.id === appState.tone);
    if (tone) {
      descEl.textContent = tone.description || '';
    }
  }
}

/**
 * Toggle narration on/off
 */
function toggleNarration() {
  appState.narrationEnabled = !appState.narrationEnabled;
  const toggle = document.getElementById('narrationEnabled');
  if (toggle) {
    toggle.checked = appState.narrationEnabled;
  }
  const statusText = document.getElementById('narrationStatusText');
  if (statusText) {
    statusText.textContent = appState.narrationEnabled ? 'Enabled' : 'Disabled';
  }
}

/**
 * Clear history
 */
function clearHistory() {
  if (confirm('Clear all narration history?')) {
    appState.narrationHistory = [];
    renderHistory();
  }
}

/**
 * Update connection status UI
 */
function updateConnectionStatus(isConnected, provider) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('connectionStatus');
  const providerBadge = document.getElementById('providerBadge');
  const llmProvider = document.getElementById('llmProvider');

  if (statusDot) {
    statusDot.classList.toggle('connected', isConnected);
  }
  if (statusText) {
    statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
  }
  if (provider) {
    appState.llmProvider = provider;
    if (providerBadge) providerBadge.textContent = provider;
    if (llmProvider) llmProvider.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

/**
 * Initialize app on DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize editor
    await initMonacoEditor();
    console.log('✓ Monaco Editor initialized');

    // Setup event listeners
    setupEventListeners();

    // Load personas and tones
    loadPersonas();
    loadTones();

    // Initialize WebSocket
    initWebSocket();

    // Keyboard shortcuts
    setupKeyboardShortcuts();

    console.log('✓ Narrator IDE ready');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Persona selector
  const personaSelect = document.getElementById('personaSelect');
  if (personaSelect) {
    personaSelect.addEventListener('change', (e) => setPersona(e.target.value));
  }

  // Tone selector
  const toneSelect = document.getElementById('toneSelect');
  if (toneSelect) {
    toneSelect.addEventListener('change', (e) => setTone(e.target.value));
  }

  // Narration toggle
  const narrationToggle = document.getElementById('narrationToggle');
  if (narrationToggle) {
    narrationToggle.addEventListener('click', toggleNarration);
  }

  const narrationEnabled = document.getElementById('narrationEnabled');
  if (narrationEnabled) {
    narrationEnabled.addEventListener('change', toggleNarration);
  }

  // Clear history
  const clearHistoryBtn = document.getElementById('clearHistory');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearHistory);
  }

  // Mobile tab switching
  const mobileTabs = document.querySelectorAll('.mobile-tab');
  mobileTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchMobileTab(tab.dataset.tab);
    });
  });

  // Settings modal
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettings = document.getElementById('closeSettings');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const settingsBackdrop = document.getElementById('settingsBackdrop');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('active');
    });
  }

  const closeSettingsHandler = () => {
    settingsModal.classList.remove('active');
  };

  if (closeSettings) closeSettings.addEventListener('click', closeSettingsHandler);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsHandler);
  if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettingsHandler);

  // Help modal
  const helpBtn = document.getElementById('helpBtn');
  const closeHelp = document.getElementById('closeHelp');
  const helpModal = document.getElementById('helpModal');
  const helpBackdrop = document.getElementById('helpBackdrop');

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      helpModal.classList.add('active');
    });
  }

  const closeHelpHandler = () => {
    helpModal.classList.remove('active');
  };

  if (closeHelp) closeHelp.addEventListener('click', closeHelpHandler);
  if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelpHandler);

  // Sidebar collapse
  const collapseLeft = document.getElementById('collapseLeft');
  const collapseRight = document.getElementById('collapseRight');
  const sidebarLeft = document.getElementById('sidebarLeft');
  const sidebarRight = document.getElementById('sidebarRight');

  if (collapseLeft) {
    collapseLeft.addEventListener('click', () => {
      sidebarLeft.classList.toggle('collapsed');
    });
  }

  if (collapseRight) {
    collapseRight.addEventListener('click', () => {
      sidebarRight.classList.toggle('collapsed');
    });
  }

  // LLM provider selector
  const llmProviderSelect = document.getElementById('llmProviderSelect');
  if (llmProviderSelect) {
    llmProviderSelect.addEventListener('change', (e) => {
      appState.llmProvider = e.target.value;
      // Notify server
      if (window.ws && window.ws.readyState === WebSocket.OPEN) {
        window.ws.send(JSON.stringify({
          type: 'set-llm-provider',
          provider: e.target.value
        }));
      }
    });
  }

  // TTS toggle
  const ttsEnabled = document.getElementById('ttsEnabled');
  if (ttsEnabled) {
    ttsEnabled.addEventListener('change', (e) => {
      appState.ttsEnabled = e.target.checked;
      const audioSection = document.getElementById('audioSection');
      if (audioSection) {
        audioSection.style.display = appState.ttsEnabled ? 'flex' : 'none';
      }
    });
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+N: Toggle narration
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      toggleNarration();
    }

    // Ctrl+Alt+P: Next persona
    if (e.ctrlKey && e.altKey && e.key === 'P') {
      e.preventDefault();
      cyclePersona();
    }

    // Ctrl+Alt+T: Next tone
    if (e.ctrlKey && e.altKey && e.key === 'T') {
      e.preventDefault();
      cycleTone();
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
      document.getElementById('settingsModal').classList.remove('active');
      document.getElementById('helpModal').classList.remove('active');
    }
  });
}

/**
 * Cycle to next persona
 */
function cyclePersona() {
  if (appState.personas.length === 0) return;
  const currentIndex = appState.personas.findIndex(p => p.id === appState.persona);
  const nextIndex = (currentIndex + 1) % appState.personas.length;
  setPersona(appState.personas[nextIndex].id);
}

/**
 * Cycle to next tone
 */
function cycleTone() {
  if (appState.tones.length === 0) return;
  const currentIndex = appState.tones.findIndex(t => t.id === appState.tone);
  const nextIndex = (currentIndex + 1) % appState.tones.length;
  setTone(appState.tones[nextIndex].id);
}

/**
 * Switch mobile tab
 */
function switchMobileTab(tabName) {
  // Update active tab button
  document.querySelectorAll('.mobile-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Show/hide mobile sheet content
  const sheet = document.getElementById('mobileSheet');
  const content = document.getElementById('mobileSheetContent');

  if (tabName === 'narration') {
    content.innerHTML = document.getElementById('liveNarration').innerHTML;
    sheet.classList.add('active');
  } else if (tabName === 'history') {
    content.innerHTML = document.getElementById('narrationHistory').innerHTML;
    sheet.classList.add('active');
  } else {
    sheet.classList.remove('active');
  }
}

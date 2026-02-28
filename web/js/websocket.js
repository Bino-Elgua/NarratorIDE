/**
 * Narrator IDE - WebSocket Handler
 * Real-time communication with server
 */

let ws = null;
const WS_RECONNECT_DELAY = 3000;
const WS_RECONNECT_MAX_ATTEMPTS = 10;
let wsReconnectAttempts = 0;

/**
 * Initialize WebSocket connection
 */
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✓ Connected to Narrator Server');
    wsReconnectAttempts = 0;
    updateConnectionStatus(true);
    
    // Request initial state
    ws.send(JSON.stringify({ type: 'get-state' }));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus(false);
  };

  ws.onclose = () => {
    console.log('✗ Disconnected from Narrator Server');
    updateConnectionStatus(false);
    attemptReconnect();
  };
}

/**
 * Attempt to reconnect to WebSocket
 */
function attemptReconnect() {
  if (wsReconnectAttempts >= WS_RECONNECT_MAX_ATTEMPTS) {
    console.error('Failed to reconnect after', WS_RECONNECT_MAX_ATTEMPTS, 'attempts');
    showError('Failed to connect to server. Please refresh the page.');
    return;
  }

  wsReconnectAttempts++;
  const delay = WS_RECONNECT_DELAY * wsReconnectAttempts;
  console.log(`Attempting to reconnect in ${delay}ms...`);

  setTimeout(() => {
    initWebSocket();
  }, delay);
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'state':
      handleStateUpdate(message.data);
      break;

    case 'narration':
      handleNarration(message.data);
      break;

    case 'personas':
      handlePersonasUpdate(message.data);
      break;

    case 'tones':
      handleTonesUpdate(message.data);
      break;

    case 'persona-changed':
      appState.persona = message.data.language;
      updatePersonaUI();
      break;

    case 'tone-changed':
      appState.tone = message.data.tone;
      updateToneUI();
      break;

    case 'error':
      handleError(message.data);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

/**
 * Handle state update from server
 */
function handleStateUpdate(state) {
  if (state.language) {
    appState.language = state.language;
  }
  if (state.persona) {
    appState.persona = state.persona.id || state.persona;
  }
  if (state.tone) {
    appState.tone = state.tone.id || state.tone;
  }
  if (state.llmProvider) {
    appState.llmProvider = state.llmProvider;
    updateConnectionStatus(true, state.llmProvider);
  }

  updateUI();
}

/**
 * Handle personas list update
 */
function handlePersonasUpdate(personas) {
  appState.personas = personas;
  
  const select = document.getElementById('personaSelect');
  if (select) {
    const currentValue = select.value;
    select.innerHTML = personas
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join('');
    select.value = currentValue || appState.persona;
  }

  updatePersonaUI();
}

/**
 * Handle tones list update
 */
function handleTonesUpdate(tones) {
  appState.tones = tones;

  const select = document.getElementById('toneSelect');
  if (select) {
    const currentValue = select.value;
    select.innerHTML = tones
      .map(t => `<option value="${t.id}">${t.name}</option>`)
      .join('');
    select.value = currentValue || appState.tone;
  }

  updateToneUI();
}

/**
 * Handle error messages from server
 */
function handleError(errorData) {
  console.error('Server error:', errorData);
  
  const message = errorData.message || 'An error occurred';
  const type = errorData.type || 'error';

  showError(`[${type}] ${message}`);

  // If LLM provider failed, update UI to show fallback
  if (errorData.fallbackProvider) {
    updateConnectionStatus(true, errorData.fallbackProvider);
  }
}

/**
 * Show error notification
 */
function showError(message) {
  // Could integrate with a toast notification system here
  console.error(message);

  // Brief visual feedback in editor status
  const statusEl = document.getElementById('editorStatus');
  if (statusEl) {
    const originalText = statusEl.textContent;
    statusEl.textContent = `⚠️ ${message}`;
    statusEl.style.color = 'var(--color-red)';
    
    setTimeout(() => {
      statusEl.textContent = originalText;
      statusEl.style.color = 'inherit';
    }, 5000);
  }
}

/**
 * Update all UI elements
 */
function updateUI() {
  updatePersonaUI();
  updateToneUI();
  const detectedLangEl = document.getElementById('detectedLanguage');
  if (detectedLangEl) {
    detectedLangEl.textContent = appState.language.toUpperCase();
  }
}

/**
 * Send WebSocket message with error handling
 */
function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  } else {
    console.warn('WebSocket not ready. Message not sent:', message);
    return false;
  }
}

/**
 * Export for use in other modules
 */
window.sendMessage = sendMessage;

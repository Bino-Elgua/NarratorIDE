import { EditorManager } from './editor/editor-manager.js';
import { getLanguageFromPath } from './editor/monaco-loader.js';
import { TerminalComponent } from './terminal/terminal-component.js';
import { FileTree } from './components/file-tree.js';
import { SplitPane } from './components/split-pane.js';
import { StatusBar } from './components/status-bar.js';
import { NarratorUI } from './narration/narrator-ui.js';
import { AudioController } from './narration/audio-controller.js';
import { ThinkingVisualizer } from './narration/thinking-visualizer.js';
import { ClawbotClient } from './clawbot/clawbot-client.js';
import { ClawbotUI } from './clawbot/clawbot-ui.js';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;
const RECONNECT_DELAY = 2000;

let editorManager, terminal, fileTree, splitPane, statusBar;
let narratorUI, audioController, thinkingVisualizer;
let clawbotClient, clawbotUI;
let streamingRef = null;

function send(msg) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function showNotification(text, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = text;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '40px',
    right: '16px',
    padding: '10px 20px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 0.3s',
    background: type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}`);

  socket.onopen = () => {
    reconnectAttempts = 0;
    statusBar.setWsStatus('connected');

    send({ type: 'editor-tree' });
    send({ type: 'get-state' });

    if (!terminal) {
      const sessionId = 'term-' + Date.now();
      terminal = new TerminalComponent('terminal-container', socket);
      terminal.init(sessionId);
    } else {
      terminal.socket = socket;
    }

    clawbotClient = new ClawbotClient(socket);
    fileTree.socket = socket;
  };

  socket.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    handleMessage(msg);
  };

  socket.onclose = () => {
    statusBar.setWsStatus('disconnected');
    attemptReconnect();
  };

  socket.onerror = () => {
    statusBar.setWsStatus('disconnected');
  };
}

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    showNotification('Connection lost. Please refresh the page.', 'error');
    return;
  }
  reconnectAttempts++;
  statusBar.setWsStatus('reconnecting');
  setTimeout(connectWebSocket, RECONNECT_DELAY);
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'file-tree':
      fileTree.handleTreeData(msg.data);
      break;

    case 'file-content': {
      const fc = msg.data || msg;
      editorManager.openFile(msg.path, fc.content, fc.language);
      statusBar.setLanguage(fc.language || getLanguageFromPath(msg.path));
      break;
    }

    case 'file-saved':
      showNotification(`Saved: ${(msg.data || msg).path || 'file'}`, 'success');
      break;

    case 'terminal-output':
      if (terminal) terminal.handleOutput(msg.data);
      break;

    case 'narration': {
      const n = msg.data || msg;
      narratorUI.addNarration(n);
      if (n.audio) {
        audioController.play(n.audio, { priority: 'high', interrupt: true });
      } else if (n.text) {
        audioController.playTTS(n.text);
      }
      statusBar.setNarrationStatus('speaking');
      break;
    }

    case 'thinking-narration': {
      const th = msg.data || msg;
      thinkingVisualizer.addThought(th.text, th.persona);
      if (th.text) {
        audioController.playTTS(th.text, { rate: 1.2 });
      }
      break;
    }

    case 'action-narration': {
      const a = msg.data || msg;
      thinkingVisualizer.addAction(a.action, a.description);
      break;
    }

    case 'clawbot-response':
      if (msg.streaming) {
        if (!streamingRef) {
          streamingRef = clawbotUI.addBotMessage('', { streaming: true });
        }
        clawbotUI.updateStreamingMessage(streamingRef, msg.text);
        statusBar.setClawbotStatus('thinking');
      } else if (msg.done) {
        if (streamingRef) {
          clawbotUI.finalizeStreaming(streamingRef);
          streamingRef = null;
        }
        statusBar.setClawbotStatus('connected');
      } else {
        const parsed = clawbotClient.handleResponse(msg);
        clawbotUI.addBotMessage(parsed.text);
        statusBar.setClawbotStatus('connected');
      }
      break;

    case 'persona-changed': {
      const lang = msg.data?.language;
      showNotification(`Persona: ${lang}`);
      const ps = document.getElementById('persona-select');
      if (ps && lang) ps.value = lang;
      break;
    }

    case 'tone-changed': {
      const t = msg.data?.tone;
      showNotification(`Tone: ${t}`);
      const ts = document.getElementById('tone-select');
      if (ts && t) ts.value = t;
      break;
    }

    case 'state': {
      const d = msg.data || msg;
      if (d.language) {
        const ps2 = document.getElementById('persona-select');
        if (ps2) ps2.value = d.language;
      }
      if (d.tone) {
        const ts2 = document.getElementById('tone-select');
        if (ts2) ts2.value = d.tone;
      }
      statusBar.setNarrationStatus('ready');
      break;
    }

    case 'error':
      console.error('Server error:', msg.message);
      showNotification(msg.message || 'An error occurred', 'error');
      break;
  }
}

function wireUIControls() {
  const personaSelect = document.getElementById('persona-select');
  if (personaSelect) {
    personaSelect.addEventListener('change', () => {
      send({ type: 'set-persona', language: personaSelect.value });
    });
  }

  const toneSelect = document.getElementById('tone-select');
  if (toneSelect) {
    toneSelect.addEventListener('change', () => {
      send({ type: 'set-tone', tone: toneSelect.value });
    });
  }

  const narrateBtn = document.getElementById('narrate-btn');
  if (narrateBtn) {
    narrateBtn.addEventListener('click', () => {
      send({ type: 'toggle-narration' });
    });
  }

  const clawbotBtn = document.getElementById('clawbot-btn');
  const clawbotPanel = document.getElementById('clawbot-panel');
  if (clawbotBtn && clawbotPanel) {
    clawbotBtn.addEventListener('click', () => {
      clawbotPanel.classList.toggle('visible');
    });
  }

  const thinkingToggle = document.getElementById('thinking-toggle');
  if (thinkingToggle) {
    thinkingToggle.addEventListener('click', () => {
      const visible = thinkingVisualizer.container.style.display !== 'none';
      thinkingVisualizer.setVisible(!visible);
      send({ type: 'set-thinking-visible', visible: !visible });
    });
  }

  const clawbotInput = document.getElementById('clawbot-input');
  const clawbotSend = document.getElementById('clawbot-send');
  const sendClawbotMessage = () => {
    if (!clawbotInput || !clawbotInput.value.trim()) return;
    const text = clawbotInput.value.trim();
    clawbotUI.addUserMessage(text);
    clawbotClient.sendPrompt(text, {
      activeFile: editorManager.activeFile,
      content: editorManager.activeFile ? editorManager.getContent() : undefined,
    });
    clawbotInput.value = '';
  };

  if (clawbotInput) {
    clawbotInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendClawbotMessage();
      }
    });
  }
  if (clawbotSend) {
    clawbotSend.addEventListener('click', sendClawbotMessage);
  }

  editorManager.onSave = (result) => {
    send({ type: 'editor-save', path: result.path, content: result.content });
  };

  fileTree.onFileSelect = (path) => {
    send({ type: 'editor-open', path });
  };

  editorManager.onCursorChange((pos) => {
    statusBar.setPosition(pos.line, pos.column);
  });

  editorManager.onContentChange = (path) => {
    statusBar.setLanguage(getLanguageFromPath(path));
  };

  window.addEventListener('resize', () => {
    if (terminal) terminal.fit();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  statusBar = new StatusBar();
  statusBar.setWsStatus('disconnected');
  statusBar.setPosition(1, 1);
  statusBar.setLanguage('Plain Text');
  statusBar.setNarrationStatus('ready');
  statusBar.setClawbotStatus('disconnected');

  editorManager = new EditorManager('editor-container', 'tab-bar');
  await editorManager.init();

  const socketProxy = { send: (data) => {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(msg);
  }};

  fileTree = new FileTree('file-tree', socketProxy);

  splitPane = new SplitPane('h-splitter', 'editor-container', 'terminal-panel');
  splitPane.init();

  narratorUI = new NarratorUI('narration-history', 'current-narration');
  audioController = new AudioController();
  thinkingVisualizer = new ThinkingVisualizer('thinking-stream');

  clawbotUI = new ClawbotUI('clawbot-chat', 'clawbot-input');

  connectWebSocket();
  wireUIControls();
});

/**
 * Centralized WebSocket Message Router for NarratorIDE
 * Routes incoming messages to the appropriate service handler
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { PERSONAS, TONES, getPersona } = require('./personas');

class WebSocketHandler {
  /**
   * @param {WebSocket.Server} wss
   * @param {import('./narrator')} narrator
   * @param {import('./tts')} tts
   * @param {import('./file-system')} fileSystem
   * @param {import('./terminal-manager')} terminalManager
   * @param {import('./git-manager')} gitManager
   * @param {import('./analytics-service')} analytics
   * @param {import('./clawbot-service')} clawbotService
   * @param {import('./thinking-narrator')} thinkingNarrator
   */
  constructor(wss, narrator, tts, fileSystem, terminalManager, gitManager, analytics, clawbotService, thinkingNarrator) {
    this.wss = wss;
    this.narrator = narrator;
    this.tts = tts;
    this.fileSystem = fileSystem;
    this.terminalManager = terminalManager;
    this.gitManager = gitManager;
    this.analytics = analytics;
    this.clawbotService = clawbotService;
    this.thinkingNarrator = thinkingNarrator;

    /** @type {Map<string, {ws: WebSocket, sessionId: string|null}>} */
    this.clients = new Map();

    this._wireServices();
    this._wireConnections();
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────

  /**
   * Wire service events that should be forwarded to clients
   */
  _wireServices() {
    // Terminal output → owning client
    this.terminalManager.on('output', (sessionId, data) => {
      for (const [clientId, client] of this.clients) {
        if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({ type: 'terminal-output', sessionId, data }));
        }
      }
    });

    this.terminalManager.on('exit', (sessionId, code) => {
      for (const [, client] of this.clients) {
        if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({ type: 'terminal-exit', sessionId, code }));
        }
      }
    });

    // File system changes → broadcast
    this.fileSystem.on('file-changed', (info) => {
      this.broadcast({ type: 'file-changed', data: info });
    });

    // Thinking narrator events → broadcast
    this.thinkingNarrator.on('thinking-chunk', (data) => {
      this.broadcast({ type: 'thinking-chunk', data });
    });
    this.thinkingNarrator.on('thinking-narration', (data) => {
      this.broadcast({ type: 'thinking-narration', data });
    });
    this.thinkingNarrator.on('action-narration', (data) => {
      this.broadcast({ type: 'action-narration', data });
    });
    this.thinkingNarrator.on('output-narration', (data) => {
      this.broadcast({ type: 'output-narration', data });
    });
    this.thinkingNarrator.on('session-complete', (data) => {
      this.broadcast({ type: 'thinking-session-complete', data });
    });
  }

  /**
   * Set up the WebSocket connection handler
   */
  _wireConnections() {
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      this.clients.set(clientId, { ws, sessionId: null, cursor: null });

      console.log(`[${clientId}] Client connected. Total: ${this.clients.size}`);
      
      // Broadcast join
      this.broadcast({ type: 'user-join', clientId, total: this.clients.size });

      ws.on('message', async (raw) => {
        try {
          const message = JSON.parse(raw);
          await this._route(clientId, message);
        } catch (err) {
          console.error('Message handling error:', err);
          this._send(clientId, { type: 'error', error: err.message });
        }
      });

      ws.on('close', () => {
        const client = this.clients.get(clientId);
        if (client && client.sessionId) {
          this.terminalManager.destroySession(client.sessionId);
        }
        this.clients.delete(clientId);
        console.log(`[${clientId}] Client disconnected. Total: ${this.clients.size}`);

        // Broadcast leave
        this.broadcast({ type: 'user-leave', clientId, total: this.clients.size });
      });

      // Send initial state
      this._send(clientId, { type: 'state', data: this.narrator.getState() });
    });
  }

  // ─── Message router ────────────────────────────────────────────────

  /**
   * Route a parsed message to the correct handler
   * @param {string} clientId
   * @param {object} message
   */
  async _route(clientId, message) {
    switch (message.type) {
      // ── Editor ──
      case 'editor-open':
        return this._handleEditorOpen(clientId, message);
      case 'editor-save':
        return this._handleEditorSave(clientId, message);
      case 'editor-list':
        return this._handleEditorList(clientId, message);
      case 'editor-tree':
        return this._handleEditorTree(clientId, message);
      case 'editor-create-file':
        return this._handleEditorCreateFile(clientId, message);
      case 'editor-create-dir':
        return this._handleEditorCreateDir(clientId, message);
      case 'editor-delete':
        return this._handleEditorDelete(clientId, message);
      case 'editor-rename':
        return this._handleEditorRename(clientId, message);

      // ── Terminal ──
      case 'terminal-create':
        return this._handleTerminalCreate(clientId, message);
      case 'terminal-input':
        return this._handleTerminalInput(clientId, message);
      case 'terminal-resize':
        return this._handleTerminalResize(clientId, message);
      case 'terminal-destroy':
        return this._handleTerminalDestroy(clientId, message);

      // ── Git ──
      case 'git-status':
        return this._handleGitStatus(clientId, message);

      // ── Collaboration ──
      case 'cursor-move':
        return this._handleCursorMove(clientId, message);

      // ── Narration ──
      case 'code-change':
        return this._handleCodeChange(clientId, message);
      case 'set-persona':
        return this._handleSetPersona(clientId, message);
      case 'set-tone':
        return this._handleSetTone(clientId, message);
      case 'get-state':
        return this._send(clientId, { type: 'state', data: this.narrator.getState() });
      case 'get-personas':
        return this._send(clientId, {
          type: 'personas',
          data: Object.entries(PERSONAS).map(([key, p]) => ({
            id: key, name: p.name, language: p.language,
          })),
        });
      case 'get-tones':
        return this._send(clientId, {
          type: 'tones',
          data: Object.entries(TONES).map(([key, t]) => ({
            id: key, name: t.name, description: t.description,
          })),
        });
      case 'clear-history':
        this.narrator.clearHistory();
        return this.broadcast({ type: 'history-cleared' });

      // ── Clawbot ──
      case 'clawbot-prompt':
        return this._handleClawbotPrompt(clientId, message);
      case 'clawbot-execute-skill':
        return this._handleClawbotSkill(clientId, message);

      // ── Thinking Narration ──
      case 'narrate-with-thinking':
        return this._handleNarrateWithThinking(clientId, message);

      // ── Vibe Coder ──
      case 'vibe-start':
        if (this.vibeHandler) return this.vibeHandler.handleVibeStart(clientId, message);
        return this._send(clientId, { type: 'error', error: 'Vibe handler not initialized' });
      case 'vibe-stop':
        if (this.vibeHandler) return this.vibeHandler.handleVibeStop(clientId);
        return;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  // ─── Editor handlers ──────────────────────────────────────────────

  async _handleEditorOpen(clientId, msg) {
    const result = await this.fileSystem.readFile(msg.path);
    this._send(clientId, { type: 'file-content', path: msg.path, data: result });
  }

  async _handleEditorSave(clientId, msg) {
    const result = await this.fileSystem.writeFile(msg.path, msg.content);
    this._send(clientId, { type: 'file-saved', data: result });
  }

  async _handleEditorList(clientId, msg) {
    const result = await this.fileSystem.listDirectory(msg.path || '.');
    this._send(clientId, { type: 'file-list', path: msg.path || '.', data: result });
  }

  async _handleEditorTree(clientId, msg) {
    const result = await this.fileSystem.getTree(msg.path || '.');
    this._send(clientId, { type: 'file-tree', data: result });
  }

  async _handleEditorCreateFile(clientId, msg) {
    const result = await this.fileSystem.createFile(msg.path, msg.content);
    this._send(clientId, { type: 'file-created', data: result });
  }

  async _handleEditorCreateDir(clientId, msg) {
    const result = await this.fileSystem.createDirectory(msg.path);
    this._send(clientId, { type: 'dir-created', data: result });
  }

  async _handleEditorDelete(clientId, msg) {
    const result = await this.fileSystem.deleteFile(msg.path);
    this._send(clientId, { type: 'file-deleted', path: msg.path, data: result });
  }

  async _handleEditorRename(clientId, msg) {
    const result = await this.fileSystem.rename(msg.oldPath, msg.newPath);
    this._send(clientId, { type: 'file-renamed', data: result });
  }

  // ─── Terminal handlers ─────────────────────────────────────────────

  _handleTerminalCreate(clientId, msg) {
    const sessionId = msg.sessionId || uuidv4();
    const result = this.terminalManager.createSession(sessionId, {
      cwd: msg.cwd,
      cols: msg.cols,
      rows: msg.rows,
    });
    // Associate this client with the terminal session
    const client = this.clients.get(clientId);
    if (client) client.sessionId = sessionId;
    
    // Track analytics
    this.analytics.trackTerminalSession();
    
    this._send(clientId, { type: 'terminal-created', data: result });
  }

  _handleTerminalInput(clientId, msg) {
    const client = this.clients.get(clientId);
    const sessionId = msg.sessionId || (client && client.sessionId);
    if (sessionId) {
      this.terminalManager.write(sessionId, msg.data);
    }
  }

  _handleTerminalResize(clientId, msg) {
    const client = this.clients.get(clientId);
    const sessionId = msg.sessionId || (client && client.sessionId);
    if (sessionId) {
      this.terminalManager.resize(sessionId, msg.cols, msg.rows);
    }
  }

  _handleTerminalDestroy(clientId, msg) {
    const client = this.clients.get(clientId);
    const sessionId = msg.sessionId || (client && client.sessionId);
    if (sessionId) {
      this.terminalManager.destroySession(sessionId);
      if (client) client.sessionId = null;
    }
  }

  // ─── Git handlers ──────────────────────────────────────────────────

  async _handleGitStatus(clientId, msg) {
    const summary = await this.gitManager.getSummary();
    this._send(clientId, { type: 'git-summary', data: summary });
  }

  // ─── Collaboration handlers ───────────────────────────────────────

  _handleCursorMove(clientId, msg) {
    const client = this.clients.get(clientId);
    if (client) {
      client.cursor = msg.position;
      // Broadcast to others (not self)
      const data = JSON.stringify({ type: 'cursor-move', clientId, position: msg.position });
      for (const [id, c] of this.clients) {
        if (id !== clientId && c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(data);
        }
      }
    }
  }

  // ─── Narration handlers ───────────────────────────────────────────

  async _handleCodeChange(clientId, msg) {
    const { code, language, filename, tone, previousCode, summary } = msg;

    let gitDiff = null;
    if (filename) {
      gitDiff = await this.gitManager.getDiff(filename);
    }

    const codeChange = {
      before: previousCode || '',
      after: code,
      summary: summary || `Updated ${filename || 'code'}`,
      gitDiff
    };

    const narration = await this.narrator.narrate(codeChange, {
      filename,
      language: language || undefined,
      tone: tone || this.narrator.currentTone,
    });

    if (!narration) return;

    // Track analytics
    this.analytics.trackNarration(
      this.narrator.currentLanguage,
      this.narrator.currentTone,
      this.narrator.currentLanguage
    );

    const audioBuffer = await this.tts.synthesize(narration, this.narrator.currentLanguage);

    this.broadcast({
      type: 'narration',
      data: {
        text: narration,
        language: this.narrator.currentLanguage,
        tone: this.narrator.currentTone,
        persona: getPersona(this.narrator.currentLanguage),
        audio: audioBuffer ? audioBuffer.toString('base64') : null,
        timestamp: new Date(),
      },
    });
  }

  _handleSetPersona(clientId, msg) {
    if (this.narrator.setPersona(msg.language)) {
      this.broadcast({
        type: 'persona-changed',
        data: { language: msg.language, persona: getPersona(msg.language) },
      });
    } else {
      this._send(clientId, { type: 'error', error: `Unknown language: ${msg.language}` });
    }
  }

  _handleSetTone(clientId, msg) {
    if (this.narrator.setTone(msg.tone)) {
      this.broadcast({ type: 'tone-changed', data: { tone: msg.tone } });
    } else {
      this._send(clientId, { type: 'error', error: `Unknown tone: ${msg.tone}` });
    }
  }

  // ─── Clawbot handlers ─────────────────────────────────────────────

  async _handleClawbotPrompt(clientId, msg) {
    try {
      for await (const chunk of this.clawbotService.agenticCodeEdit(msg.prompt, msg.fileContext)) {
        this._send(clientId, { type: 'clawbot-chunk', data: chunk });
        if (chunk.type === 'done') break;
      }
    } catch (err) {
      this._send(clientId, { type: 'clawbot-error', error: err.message });
    }
  }

  async _handleClawbotSkill(clientId, msg) {
    try {
      const result = await this.clawbotService.executeSkill(msg.skill, msg.params);
      this._send(clientId, { type: 'clawbot-skill-result', data: result });
    } catch (err) {
      this._send(clientId, { type: 'clawbot-error', error: err.message });
    }
  }

  // ─── Thinking narration handler ────────────────────────────────────

  async _handleNarrateWithThinking(clientId, msg) {
    try {
      // Track analytics
      this.analytics.trackThinkingSession();
      
      await this.thinkingNarrator.startSession(msg.prompt, msg.codeContext, {
        persona: msg.persona,
        tone: msg.tone,
        enableAudio: msg.enableAudio,
      });
    } catch (err) {
      this.analytics.trackError('thinking');
      this._send(clientId, { type: 'error', error: err.message });
    }
  }

  // ─── Transport helpers ─────────────────────────────────────────────

  /**
   * Send a message to a specific client
   * @param {string} clientId
   * @param {object} message
   */
  _send(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message to a specific client (public alias)
   * @param {string} clientId
   * @param {object} message
   */
  sendTo(clientId, message) {
    this._send(clientId, message);
  }

  /**
   * Broadcast a message to all connected clients
   * @param {object} message
   */
  broadcast(message) {
    const data = JSON.stringify(message);
    for (const [, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }
}

module.exports = WebSocketHandler;

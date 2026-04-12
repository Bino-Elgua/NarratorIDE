/**
 * WebSocket handler for Vibe Coding sessions
 * Bridges VibeOrchestrator events to connected clients
 * and routes file writes through the FileSystem manager.
 */

const WebSocket = require('ws');
const path = require('path');

class VibeWebSocketHandler {
  /**
   * @param {import('./websocket-handler')} wsHandler
   * @param {import('./vibe-orchestrator').VibeOrchestrator} orchestrator
   * @param {import('./file-system')} fileSystem
   */
  constructor(wsHandler, orchestrator, fileSystem) {
    this.wsHandler = wsHandler;
    this.orchestrator = orchestrator;
    this.fileSystem = fileSystem;
    this.clientSessions = new Map();
  }

  async handleVibeStart(clientId, msg) {
    this.handleVibeStop(clientId);

    const stream = this.orchestrator.startVibeSession(
      msg.prompt,
      msg.context || {},
      {
        persona: msg.persona,
        tone: msg.tone,
        enableAudio: msg.enableAudio !== false,
      }
    );

    const controller = { sessionId: null, abortFn: () => {} };
    this.clientSessions.set(clientId, controller);

    try {
      for await (const event of stream) {
        if (event.sessionId && !controller.sessionId) {
          controller.sessionId = event.sessionId;
        }

        if (!this.wsHandler.clients.has(clientId)) {
          this.orchestrator.stopSession(event.sessionId);
          break;
        }

        // Forward all events to client
        this.wsHandler.sendTo(clientId, event);

        // Write files on file-complete and update file tree
        if (event.type === 'file-complete' && event.file && event.code) {
          await this._writeFileAndUpdateTree(clientId, event);
        }
      }
    } catch (err) {
      console.error('[VibeWS] session error:', err.message);
      this.wsHandler.sendTo(clientId, { type: 'error', error: err.message });
    } finally {
      this.clientSessions.delete(clientId);
    }
  }

  async _writeFileAndUpdateTree(clientId, event) {
    try {
      const dir = path.dirname(event.file);
      if (dir && dir !== '.') {
        await this.fileSystem.createDirectory(dir).catch(() => {});
      }

      await this.fileSystem.writeFile(event.file, event.code);
      console.log(`[VibeWS] Written file: ${event.file} (${event.code.length} bytes)`);

      // Send file content for editor (LEFT PANEL)
      this.wsHandler.sendTo(clientId, {
        type: 'file-content',
        path: event.file,
        data: { content: event.code },
        isNew: true,
        language: event.language,
      });

      // Refresh file tree (LEFT PANEL)
      try {
        const tree = await this.fileSystem.getTree('.');
        this.wsHandler.sendTo(clientId, { type: 'file-tree', data: tree });
      } catch (err) {
        console.error('[VibeWS] Tree refresh failed:', err.message);
      }
    } catch (err) {
      console.error(`[VibeWS] Failed to write ${event.file}:`, err.message);
      this.wsHandler.sendTo(clientId, {
        type: 'error',
        error: `Failed to write ${event.file}: ${err.message}`,
      });
    }
  }

  handleVibeStop(clientId) {
    const session = this.clientSessions.get(clientId);
    if (session && session.sessionId) {
      this.orchestrator.stopSession(session.sessionId);
    }
    this.clientSessions.delete(clientId);
  }
}

module.exports = VibeWebSocketHandler;

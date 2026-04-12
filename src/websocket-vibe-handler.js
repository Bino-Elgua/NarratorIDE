/**
 * WebSocket handler for Vibe Coding sessions
 * Bridges VibeOrchestrator events to connected clients
 * and routes file writes through the FileSystem manager.
 */

const WebSocket = require('ws');

class VibeWebSocketHandler {
  /**
   * @param {import('./websocket-handler')} wsHandler   - Main WS handler (for _send / broadcast)
   * @param {import('./vibe-orchestrator')} orchestrator
   * @param {import('./file-system')} fileSystem
   */
  constructor(wsHandler, orchestrator, fileSystem) {
    this.wsHandler = wsHandler;
    this.orchestrator = orchestrator;
    this.fileSystem = fileSystem;

    /** @type {Map<string, { sessionId: string, abortFn: Function }>} */
    this.clientSessions = new Map();
  }

  /**
   * Handle an incoming vibe-start message from a client.
   * Spawns the dual-model orchestration and streams events back.
   */
  async handleVibeStart(clientId, msg) {
    // Stop any prior session for this client
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

    // Track so we can abort later
    const controller = { sessionId: null, abortFn: () => {} };
    this.clientSessions.set(clientId, controller);

    try {
      for await (const event of stream) {
        // Capture session ID
        if (event.sessionId && !controller.sessionId) {
          controller.sessionId = event.sessionId;
        }

        // Check client is still connected
        if (!this.wsHandler.clients.has(clientId)) {
          this.orchestrator.stopSession(event.sessionId);
          break;
        }

        // Forward event to client
        this.wsHandler.sendTo(clientId, event);

        // Execute file writes immediately on file-complete
        if (event.type === 'file-complete' && event.file && event.code) {
          try {
            await this.fileSystem.writeFile(event.file, event.code);
            this.wsHandler.broadcast({
              type: 'file-changed',
              data: { path: event.file, eventType: 'change' },
            });
          } catch (err) {
            console.error(`[VibeWS] Failed to write ${event.file}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('[VibeWS] session error:', err.message);
      this.wsHandler.sendTo(clientId, { type: 'error', error: err.message });
    } finally {
      this.clientSessions.delete(clientId);
    }
  }

  /**
   * Stop an active vibe session for a client.
   */
  handleVibeStop(clientId) {
    const session = this.clientSessions.get(clientId);
    if (session && session.sessionId) {
      this.orchestrator.stopSession(session.sessionId);
    }
    this.clientSessions.delete(clientId);
  }
}

module.exports = VibeWebSocketHandler;

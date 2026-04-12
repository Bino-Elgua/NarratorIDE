/**
 * Terminal Session Manager for NarratorIDE
 * Manages spawned shell processes (no node-pty dependency)
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const os = require('os');

class TerminalManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, {process: ChildProcess, sessionId: string, cwd: string, cols: number, rows: number, createdAt: Date}>} */
    this.sessions = new Map();
  }

  /**
   * Create a new terminal session
   * @param {string} sessionId
   * @param {object} [options]
   * @param {string} [options.cwd]
   * @param {number} [options.cols=80]
   * @param {number} [options.rows=24]
   * @returns {{sessionId: string, cwd: string, createdAt: Date}}
   */
  createSession(sessionId, options = {}) {
    if (this.sessions.has(sessionId)) {
      return { sessionId, cwd: this.sessions.get(sessionId).cwd, createdAt: this.sessions.get(sessionId).createdAt };
    }

    const cwd = options.cwd || process.cwd();
    const cols = options.cols || 80;
    const rows = options.rows || 24;

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const shellArgs = os.platform() === 'win32' ? [] : ['--norc'];

    const proc = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env, COLUMNS: String(cols), LINES: String(rows) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const session = {
      process: proc,
      sessionId,
      cwd,
      cols,
      rows,
      createdAt: new Date(),
    };

    // stdout → output event
    proc.stdout.on('data', (data) => {
      this.emit('output', sessionId, data.toString());
    });

    // stderr → output event (wrapped in red ANSI)
    proc.stderr.on('data', (data) => {
      this.emit('output', sessionId, '\x1b[38;5;196m' + data.toString() + '\x1b[0m');
    });

    proc.on('error', (err) => {
      this.emit('error', sessionId, err);
    });

    proc.on('close', (code) => {
      this.sessions.delete(sessionId);
      this.emit('exit', sessionId, code);
    });

    this.sessions.set(sessionId, session);

    return { sessionId, cwd, createdAt: session.createdAt };
  }

  /**
   * Write data to a session's stdin
   * @param {string} sessionId
   * @param {string} data
   */
  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.emit('error', sessionId, new Error(`Session ${sessionId} not found`));
      return;
    }
    if (session.process.stdin.writable) {
      session.process.stdin.write(data);
    }
  }

  /**
   * Store new dimensions for a session (cannot resize a raw spawn, but track it)
   * @param {string} sessionId
   * @param {number} cols
   * @param {number} rows
   */
  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cols = cols;
      session.rows = rows;
    }
  }

  /**
   * Destroy a single session
   * @param {string} sessionId
   */
  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.kill();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Destroy all active sessions
   */
  destroyAll() {
    for (const [id, session] of this.sessions) {
      session.process.kill();
    }
    this.sessions.clear();
  }

  /**
   * List active sessions
   * @returns {Array<{sessionId:string, cwd:string, cols:number, rows:number, createdAt:Date}>}
   */
  getSessions() {
    return Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.sessionId,
      cwd: s.cwd,
      cols: s.cols,
      rows: s.rows,
      createdAt: s.createdAt,
    }));
  }
}

module.exports = TerminalManager;

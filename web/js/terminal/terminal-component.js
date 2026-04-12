export class TerminalComponent {
  constructor(containerId, socket) {
    this.containerId = containerId;
    this.socket = socket;
    this.terminal = null;
    this.fitAddon = null;
    this.sessionId = null;
  }

  init(sessionId) {
    this.sessionId = sessionId;

    this.terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1a1a1a',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255,255,255,0.2)',
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      scrollback: 5000,
    });

    this.fitAddon = new FitAddon.FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    const container = document.getElementById(this.containerId);
    this.terminal.open(container);
    this.fitAddon.fit();

    this.terminal.onData((data) => {
      this.socket.send(JSON.stringify({
        type: 'terminal-input',
        sessionId: this.sessionId,
        data,
      }));
    });

    this.socket.send(JSON.stringify({
      type: 'terminal-create',
      sessionId: this.sessionId,
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    }));
  }

  handleOutput(data) {
    if (this.terminal) {
      this.terminal.write(data);
    }
  }

  fit() {
    if (!this.fitAddon || !this.terminal) return;
    this.fitAddon.fit();
    this.socket.send(JSON.stringify({
      type: 'terminal-resize',
      sessionId: this.sessionId,
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    }));
  }

  clear() {
    if (this.terminal) {
      this.terminal.clear();
    }
  }

  execute(command) {
    this.socket.send(JSON.stringify({
      type: 'terminal-input',
      sessionId: this.sessionId,
      data: command + '\r',
    }));
  }

  focus() {
    if (this.terminal) {
      this.terminal.focus();
    }
  }

  dispose() {
    this.socket.send(JSON.stringify({
      type: 'terminal-destroy',
      sessionId: this.sessionId,
    }));
    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }
  }
}

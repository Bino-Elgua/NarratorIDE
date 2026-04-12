export class StatusBar {
  constructor() {
    this.els = {
      language: document.getElementById('status-language'),
      position: document.getElementById('status-position'),
      narration: document.getElementById('status-narration'),
      clawbot: document.getElementById('status-clawbot'),
      ws: document.getElementById('status-ws'),
    };
  }

  setLanguage(lang) {
    if (this.els.language) {
      this.els.language.textContent = lang || 'Plain Text';
    }
  }

  setPosition(line, col) {
    if (this.els.position) {
      this.els.position.textContent = `Ln ${line}, Col ${col}`;
    }
  }

  setNarrationStatus(status) {
    if (!this.els.narration) return;
    const icons = { ready: '🎙️ Ready', speaking: '🔊 Speaking', paused: '⏸️ Paused' };
    this.els.narration.textContent = icons[status] || status;
    this.els.narration.dataset.status = status;
  }

  setClawbotStatus(status) {
    if (!this.els.clawbot) return;
    const icons = { connected: '🤖 Connected', disconnected: '🤖 Offline', thinking: '🤖 Thinking...' };
    this.els.clawbot.textContent = icons[status] || status;
    this.els.clawbot.dataset.status = status;
  }

  setWsStatus(status) {
    if (!this.els.ws) return;
    const icons = { connected: '🟢 Connected', disconnected: '🔴 Disconnected', reconnecting: '🟡 Reconnecting' };
    this.els.ws.textContent = icons[status] || status;
    this.els.ws.dataset.status = status;
  }
}

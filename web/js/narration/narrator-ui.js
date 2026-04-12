export class NarratorUI {
  constructor(historyContainerId, currentContainerId) {
    this.historyEl = document.getElementById(historyContainerId);
    this.currentEl = document.getElementById(currentContainerId);
  }

  addNarration({ text, persona, tone, timestamp, audioUrl }) {
    if (this.historyEl) {
      const item = document.createElement('div');
      item.className = 'narration-item';

      const tag = document.createElement('span');
      tag.className = 'narration-persona';
      tag.textContent = persona || 'Narrator';
      item.appendChild(tag);

      const content = document.createElement('p');
      content.className = 'narration-text';
      content.textContent = text;
      item.appendChild(content);

      const time = document.createElement('span');
      time.className = 'narration-time';
      time.textContent = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      item.appendChild(time);

      this.historyEl.prepend(item);
      this.historyEl.scrollTop = 0;
    }

    this.setCurrentNarration(text);

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {});
    }
  }

  setCurrentNarration(text) {
    if (this.currentEl) {
      this.currentEl.textContent = text;
      this.currentEl.classList.add('speaking');
    }
  }

  clearCurrent() {
    if (this.currentEl) {
      this.currentEl.textContent = '';
      this.currentEl.classList.remove('speaking');
    }
  }

  clearHistory() {
    if (this.historyEl) {
      this.historyEl.innerHTML = '';
    }
  }
}

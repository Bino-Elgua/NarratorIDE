export class ClawbotUI {
  constructor(chatContainerId, inputId) {
    this.chatEl = document.getElementById(chatContainerId);
    this.inputEl = document.getElementById(inputId);
    this.messages = [];
  }

  addUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'chat-msg user';
    msg.textContent = text;

    this.messages.push({ role: 'user', text });
    if (this.chatEl) {
      this.chatEl.appendChild(msg);
      this.chatEl.scrollTop = this.chatEl.scrollHeight;
    }
  }

  addBotMessage(text, options = {}) {
    const msg = document.createElement('div');
    msg.className = 'chat-msg bot';
    msg.textContent = text || '';

    if (options.streaming) {
      msg.classList.add('streaming');
    }

    this.messages.push({ role: 'bot', text });
    if (this.chatEl) {
      this.chatEl.appendChild(msg);
      this.chatEl.scrollTop = this.chatEl.scrollHeight;
    }

    return msg;
  }

  updateStreamingMessage(ref, newContent) {
    if (ref) {
      ref.textContent += newContent;
      if (this.chatEl) {
        this.chatEl.scrollTop = this.chatEl.scrollHeight;
      }
    }
  }

  finalizeStreaming(ref) {
    if (ref) {
      ref.classList.remove('streaming');
    }
  }

  clear() {
    this.messages = [];
    if (this.chatEl) {
      this.chatEl.innerHTML = '';
    }
  }
}

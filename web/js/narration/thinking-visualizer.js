export class ThinkingVisualizer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  addThought(text, persona) {
    if (!this.container) return;

    const bubble = document.createElement('div');
    bubble.className = 'thought-bubble';
    if (persona) {
      const tag = document.createElement('span');
      tag.className = 'thought-persona';
      tag.textContent = persona;
      bubble.appendChild(tag);
    }

    const content = document.createElement('p');
    content.className = 'thought-text';
    content.textContent = text;
    bubble.appendChild(content);

    bubble.style.opacity = '0';
    this.container.appendChild(bubble);

    requestAnimationFrame(() => {
      bubble.style.transition = 'opacity 0.3s ease-in';
      bubble.style.opacity = '1';
    });

    this.container.scrollTop = this.container.scrollHeight;
  }

  addAction(action, description) {
    if (!this.container) return;

    const bubble = document.createElement('div');
    bubble.className = 'thought-bubble action-bubble';

    const actionTag = document.createElement('span');
    actionTag.className = 'action-tag';
    actionTag.textContent = `⚡ ${action}`;
    bubble.appendChild(actionTag);

    const desc = document.createElement('p');
    desc.className = 'action-description';
    desc.textContent = description;
    bubble.appendChild(desc);

    bubble.style.opacity = '0';
    this.container.appendChild(bubble);

    requestAnimationFrame(() => {
      bubble.style.transition = 'opacity 0.3s ease-in';
      bubble.style.opacity = '1';
    });

    this.container.scrollTop = this.container.scrollHeight;
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  setVisible(visible) {
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }
}

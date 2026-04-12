/**
 * AudioQueue — Manages audio playback in sync with code streaming.
 * Supports both server-generated audio (ElevenLabs base64) and browser TTS fallback.
 */

export class AudioQueue {
  constructor() {
    /** @type {Array<{ play: Function, text: string }>} */
    this.queue = [];
    this.isPlaying = false;
    this.volume = 1.0;
    this.muted = false;
    this.currentAudio = null;
    this._voicesLoaded = false;
  }

  async init() {
    // Pre-load browser voices
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this._voicesLoaded = true;
      };
    }
  }

  /**
   * Add a narration to the queue. Plays immediately if nothing is playing.
   * @param {string} text       - Narration text
   * @param {string|null} audio - Base64 audio from server, or null for browser TTS
   * @param {object} [opts]
   * @param {string} [opts.priority] - 'high' to jump queue
   * @param {number} [opts.rate]     - Speech rate (browser TTS)
   * @param {number} [opts.pitch]    - Speech pitch (browser TTS)
   */
  add(text, audio, opts = {}) {
    if (this.muted) return;

    const entry = { text, audio, ...opts };

    if (opts.priority === 'high') {
      this.queue.unshift(entry);
    } else {
      this.queue.push(entry);
    }

    if (!this.isPlaying) {
      this._processNext();
    }
  }

  /**
   * Sync point — called when code stream reaches a milestone.
   * If audio is behind, skip low-priority items.
   */
  syncTo(timestamp) {
    // Drop old low-priority items to keep narration current
    if (this.queue.length > 3) {
      this.queue = this.queue.filter(e => e.priority === 'high').concat(
        this.queue.filter(e => e.priority !== 'high').slice(-2)
      );
    }
  }

  stop() {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stop();
    return this.muted;
  }

  // ─── Internal ─────────────────────────────────────────────────────

  _processNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const entry = this.queue.shift();

    if (entry.audio) {
      this._playBase64Audio(entry);
    } else {
      this._playBrowserTTS(entry);
    }
  }

  _playBase64Audio(entry) {
    try {
      const binary = atob(entry.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = this.volume;

      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this._processNext();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this._processNext();
      };

      audio.play().catch(() => {
        this.currentAudio = null;
        this._processNext();
      });
    } catch {
      this._processNext();
    }
  }

  _playBrowserTTS(entry) {
    if (!window.speechSynthesis || !entry.text) {
      this._processNext();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(entry.text);
    utterance.rate = entry.rate || 1.1;
    utterance.pitch = entry.pitch || 1.0;
    utterance.volume = this.volume;

    utterance.onend = () => {
      this.isPlaying = false;
      this._processNext();
    };

    utterance.onerror = () => {
      this.isPlaying = false;
      this._processNext();
    };

    window.speechSynthesis.speak(utterance);
  }
}

export class AudioController {
  constructor() {
    this.queue = [];
    this.currentAudio = null;
    this.isPlaying = false;
    this.volume = 1.0;
    this.useBrowserTTS = true;
  }

  play(audioData, options = {}) {
    const { priority, speed, interrupt } = options;

    if (interrupt || priority === 'high') {
      this.stop();
    }

    if (audioData) {
      const entry = { audioData, speed: speed || 1.0 };
      if (priority === 'high') {
        this.queue.unshift(entry);
      } else {
        this.queue.push(entry);
      }
      this.processQueue();
    } else if (this.useBrowserTTS) {
      this.playTTS('');
    }
  }

  playTTS(text, options = {}) {
    if (!window.speechSynthesis || !text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = this.volume;

    if (options.voice) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name.includes(options.voice));
      if (match) utterance.voice = match;
    }

    utterance.onend = () => {
      this.isPlaying = false;
      this.processQueue();
    };

    this.isPlaying = true;
    window.speechSynthesis.speak(utterance);
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    this.isPlaying = false;
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
      this.isPlaying = true;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
      this.isPlaying = true;
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  processQueue() {
    if (this.isPlaying || this.queue.length === 0) return;

    const entry = this.queue.shift();
    this.isPlaying = true;

    try {
      const binary = atob(entry.audioData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audio.volume = this.volume;
      audio.playbackRate = entry.speed || 1.0;
      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.isPlaying = false;
        this.processQueue();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.isPlaying = false;
        this.processQueue();
      };

      audio.play().catch(() => {
        this.currentAudio = null;
        this.isPlaying = false;
        this.processQueue();
      });
    } catch {
      this.isPlaying = false;
      this.processQueue();
    }
  }
}

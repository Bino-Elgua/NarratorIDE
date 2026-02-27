/**
 * Text-to-Speech integration with ElevenLabs
 * Converts narrations to audio with persona-specific voices
 */

const axios = require('axios');
const { EventEmitter } = require('events');
const { getPersona } = require('./personas');

class TTSEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.currentVoice = 'onyx'; // default voice
    this.isAudioPlaying = false;
    
    // Voice stability settings
    this.voiceSettings = {
      stability: 0.5,
      similarity_boost: 0.75
    };
  }

  /**
   * Get voice ID for a persona
   */
  getVoiceForPersona(language) {
    const persona = getPersona(language);
    return this.getVoiceId(persona.voice);
  }

  /**
   * Map voice names to ElevenLabs voice IDs
   */
  getVoiceId(voiceName) {
    // ElevenLabs built-in voices
    const voices = {
      onyx: '9BWtsMINqrJLrRacOk9x', // deep, deliberate
      eric: 'nPczCjzI2devNBz1zQrb', // clear, professional
      alloy: 'EXAVITQu4vr4xnSDxMaL', // young, energetic
      shimmer: 'O6hPAvFMEG956LeYUnone', // bright, energetic
      sage: 'pdlR1XcmOIfZ3c5gxEmP', // wise, contemplative
      nova: 'VR6AewLTigWG4xSOukaG', // bright, uplifting
      echo: 'lXgaAx8AJxbIRGXHk5Jz' // warm, friendly
    };

    return voices[voiceName] || voices.onyx;
  }

  /**
   * Convert text to speech using ElevenLabs
   */
  async synthesize(text, language = 'javascript') {
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not configured. Skipping TTS.');
      this.emit('skip', { reason: 'no-api-key' });
      return null;
    }

    try {
      const voiceId = this.getVoiceForPersona(language);

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: this.voiceSettings
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      this.emit('synthesis-complete', {
        text,
        language,
        audioBuffer: response.data
      });

      return response.data;
    } catch (error) {
      console.error('TTS synthesis error:', error.message);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Play audio (in browser environment)
   */
  playAudio(audioBuffer) {
    if (typeof window === 'undefined') {
      console.log('TTS playback only works in browser environment');
      return;
    }

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.decodeAudioData(audioBuffer, (audioBuffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        this.isAudioPlaying = true;
        source.onended = () => {
          this.isAudioPlaying = false;
          this.emit('playback-complete');
        };
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Synthesize and store audio for later playback
   */
  async generateAudioFile(text, language = 'javascript') {
    const audioBuffer = await this.synthesize(text, language);
    
    if (!audioBuffer) {
      return null;
    }

    // Create a blob (for browser) or buffer (for Node.js)
    if (typeof Blob !== 'undefined') {
      return new Blob([audioBuffer], { type: 'audio/mpeg' });
    }
    
    return Buffer.from(audioBuffer);
  }

  /**
   * Change voice style (affects all future TTS)
   */
  setVoiceSettings(settings) {
    this.voiceSettings = {
      ...this.voiceSettings,
      ...settings
    };
    this.emit('voice-settings-changed', this.voiceSettings);
  }

  /**
   * Get list of available voices
   */
  getAvailableVoices() {
    return [
      { name: 'onyx', description: 'Deep, deliberate (Rust)' },
      { name: 'eric', description: 'Clear, professional (Go)' },
      { name: 'alloy', description: 'Young, energetic (Python)' },
      { name: 'shimmer', description: 'Bright, energetic (JavaScript/Lisp)' },
      { name: 'sage', description: 'Wise, contemplative (C)' },
      { name: 'nova', description: 'Bright, uplifting (Java)' },
      { name: 'echo', description: 'Warm, friendly (TypeScript)' }
    ];
  }
}

module.exports = TTSEngine;

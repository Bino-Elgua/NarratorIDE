/**
 * Thinking Narrator for NarratorIDE
 * Intercepts LLM reasoning tokens and converts them to persona-voiced narration
 */

const { EventEmitter } = require('events');
const { generateNarration } = require('./llm-provider');
const { getPersona } = require('./personas');

class ThinkingNarrator extends EventEmitter {
  /**
   * @param {import('./clawbot-service')} clawbotService
   * @param {import('./tts')} ttsEngine
   * @param {import('./personas')} personaEngine - the personas module (getPersona, getTone)
   */
  constructor(clawbotService, ttsEngine, personaEngine) {
    super();
    this.clawbot = clawbotService;
    this.tts = ttsEngine;
    this.personaEngine = personaEngine;

    /** @type {string[]} */
    this.thoughtBuffer = [];
    this.thoughtTimeout = null;
    this.isActive = false;
    this.currentPersona = 'javascript';
    this.currentTone = 'casual';

    /** Milliseconds to wait before flushing buffered thoughts */
    this.batchInterval = 2000;
  }

  /**
   * Start a thinking-narration session
   * @param {string} prompt
   * @param {object} [codeContext] - { filename, content, language }
   * @param {object} [options]
   * @param {string} [options.persona]
   * @param {string} [options.tone]
   * @param {boolean} [options.enableAudio=false]
   */
  async startSession(prompt, codeContext, options = {}) {
    if (this.isActive) {
      this.stopSession();
    }

    this.isActive = true;
    if (options.persona) this.currentPersona = options.persona;
    if (options.tone) this.currentTone = options.tone;

    const enableAudio = options.enableAudio || false;

    try {
      for await (const chunk of this.clawbot.agenticCodeEdit(prompt, codeContext)) {
        if (!this.isActive) break;

        switch (chunk.type) {
          case 'thinking':
            this.thoughtBuffer.push(chunk.content);
            this.emit('thinking-chunk', {
              content: chunk.content,
              persona: this.currentPersona,
              timestamp: new Date().toISOString(),
            });
            this.scheduleThoughtFlush(enableAudio);
            break;

          case 'action':
            await this.narrateAction(chunk.content, enableAudio);
            break;

          case 'content':
            await this.narrateOutput(chunk.content, enableAudio);
            break;

          case 'done':
            // Flush any remaining thoughts
            if (this.thoughtBuffer.length > 0) {
              await this.flushThoughtBuffer(enableAudio);
            }
            this.emit('session-complete', {
              persona: this.currentPersona,
              timestamp: new Date().toISOString(),
            });
            this.isActive = false;
            break;
        }
      }
    } catch (err) {
      console.error('[ThinkingNarrator] session error:', err.message);
      this.emit('error', err);
    } finally {
      this.isActive = false;
      this._clearTimeout();
    }
  }

  /**
   * Schedule a flush of the thought buffer after batchInterval
   * @param {boolean} enableAudio
   */
  scheduleThoughtFlush(enableAudio) {
    this._clearTimeout();
    this.thoughtTimeout = setTimeout(() => {
      this.flushThoughtBuffer(enableAudio).catch((err) => {
        console.error('[ThinkingNarrator] flush error:', err.message);
      });
    }, this.batchInterval);
  }

  /**
   * Flush buffered thoughts — translate to persona voice and emit
   * @param {boolean} [enableAudio=false]
   */
  async flushThoughtBuffer(enableAudio = false) {
    if (this.thoughtBuffer.length === 0) return;

    const raw = this.thoughtBuffer.join(' ');
    this.thoughtBuffer = [];
    this._clearTimeout();

    const text = await this.translateThought(raw);

    const event = {
      text,
      persona: this.currentPersona,
      timestamp: new Date().toISOString(),
    };

    if (enableAudio) {
      const audio = await this.tts.synthesize(text, this.currentPersona);
      if (audio) event.audio = audio.toString('base64');
    }

    this.emit('thinking-narration', event);
  }

  /**
   * Translate dry LLM reasoning into a persona-voiced thought
   * @param {string} rawThought
   * @returns {Promise<string>}
   */
  async translateThought(rawThought) {
    const persona = getPersona(this.currentPersona);
    const prompt = `Translate this internal thought into the voice of ${persona.name}. Keep it brief (1-2 sentences), natural, as if thinking aloud: ${rawThought}`;

    try {
      return await generateNarration(prompt, this.currentPersona, this.currentTone);
    } catch (err) {
      console.error('[ThinkingNarrator] translate error:', err.message);
      return rawThought;
    }
  }

  /**
   * Narrate a tool call or action in persona voice
   * @param {*} action - tool_calls delta from the LLM
   * @param {boolean} [enableAudio=false]
   */
  async narrateAction(action, enableAudio = false) {
    const description = typeof action === 'string'
      ? action
      : JSON.stringify(action);

    const persona = getPersona(this.currentPersona);
    const prompt = `Briefly narrate this coding action in the voice of ${persona.name} (1 sentence, thinking aloud): ${description}`;

    let text;
    try {
      text = await generateNarration(prompt, this.currentPersona, this.currentTone);
    } catch {
      text = `Performing action: ${description}`;
    }

    const event = {
      text,
      action,
      persona: this.currentPersona,
      timestamp: new Date().toISOString(),
    };

    if (enableAudio) {
      const audio = await this.tts.synthesize(text, this.currentPersona);
      if (audio) event.audio = audio.toString('base64');
    }

    this.emit('action-narration', event);
  }

  /**
   * Narrate the final output in persona voice
   * @param {string} content
   * @param {boolean} [enableAudio=false]
   */
  async narrateOutput(content, enableAudio = false) {
    const persona = getPersona(this.currentPersona);
    const prompt = `Narrate this coding result in the voice of ${persona.name}. Keep it concise (1-2 sentences): ${content.substring(0, 500)}`;

    let text;
    try {
      text = await generateNarration(prompt, this.currentPersona, this.currentTone);
    } catch {
      text = content;
    }

    const event = {
      text,
      persona: this.currentPersona,
      timestamp: new Date().toISOString(),
    };

    if (enableAudio) {
      const audio = await this.tts.synthesize(text, this.currentPersona);
      if (audio) event.audio = audio.toString('base64');
    }

    this.emit('output-narration', event);
  }

  /**
   * Stop the current session
   */
  stopSession() {
    this.isActive = false;
    this.thoughtBuffer = [];
    this._clearTimeout();
  }

  /**
   * Change the active persona
   * @param {string} persona - language key (e.g. 'rust', 'javascript')
   */
  setPersona(persona) {
    this.currentPersona = persona;
  }

  /**
   * Change the active tone
   * @param {string} tone
   */
  setTone(tone) {
    this.currentTone = tone;
  }

  /**
   * Set the batch interval for thought flushing
   * @param {number} ms
   */
  setBatchInterval(ms) {
    this.batchInterval = ms;
  }

  /** @private */
  _clearTimeout() {
    if (this.thoughtTimeout) {
      clearTimeout(this.thoughtTimeout);
      this.thoughtTimeout = null;
    }
  }
}

module.exports = ThinkingNarrator;

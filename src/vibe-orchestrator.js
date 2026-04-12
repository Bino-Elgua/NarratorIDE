/**
 * Vibe Orchestrator - Dual-Model Synchronized Workflow
 * Model A (Kimi K2.5 Coder via Ollama): Generates code with reasoning
 * Model B (Local Ollama - Qwen/Llama): Converts reasoning to persona-voiced TTS
 *
 * The magic: While Kimi types code, the narrator model speaks Kimi's thoughts
 * in real-time, creating a "pair programmer" experience.
 */

const { EventEmitter } = require('events');
const axios = require('axios');
const { getPersona } = require('./personas');

class VibeOrchestrator extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} [options.coderModel]    - Ollama model for code generation
   * @param {string} [options.narratorModel] - Ollama model for narration conversion
   * @param {string} [options.ollamaUrl]     - Ollama API base URL
   * @param {import('./tts')} options.tts    - TTS engine instance
   */
  constructor(options = {}) {
    super();

    this.coderModel = options.coderModel || process.env.VIBE_CODER_MODEL || process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud';
    this.narratorModel = options.narratorModel || process.env.VIBE_NARRATOR_MODEL || 'qwen2.5:7b';
    this.ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.tts = options.tts || null;

    /** @type {Map<string, VibeSession>} */
    this.activeSessions = new Map();
  }

  /**
   * Start a vibe coding session.
   * Returns an async iterable of events for the WebSocket layer to forward.
   *
   * @param {string} prompt      - User's natural language request
   * @param {object} context     - Current project state
   * @param {object} [opts]
   * @param {string} [opts.persona]
   * @param {string} [opts.tone]
   * @param {boolean} [opts.enableAudio]
   * @yields {VibeEvent}
   */
  async *startVibeSession(prompt, context, opts = {}) {
    const sessionId = `vibe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = {
      id: sessionId,
      prompt,
      context,
      persona: opts.persona || 'javascript',
      tone: opts.tone || 'casual',
      enableAudio: opts.enableAudio !== false,
      isActive: true,
    };

    this.activeSessions.set(sessionId, session);
    this.emit('session-start', { sessionId, prompt });

    try {
      // ── Phase 1: Stream code from Kimi while collecting thinking ──
      // We accumulate thinking chunks and periodically convert them to
      // persona narration via the local narrator model.

      let thinkingBuffer = '';
      let narratorBusy = false;
      let currentFile = null;
      let currentCode = '';
      let fileIndex = 0;

      const flushNarration = async () => {
        if (!thinkingBuffer.trim() || narratorBusy) return null;
        narratorBusy = true;
        const thoughts = thinkingBuffer.trim();
        thinkingBuffer = '';

        try {
          const narrationText = await this._convertToPersonaVoice(thoughts, session.persona, session.tone);
          let audio = null;
          if (session.enableAudio && this.tts) {
            const buf = await this.tts.synthesize(narrationText, session.persona);
            if (buf) audio = buf.toString('base64');
          }
          return {
            type: 'narration',
            text: narrationText,
            audio,
            persona: session.persona,
            timestamp: Date.now(),
            sessionId,
          };
        } catch (err) {
          console.error('[VibeOrchestrator] narrator error:', err.message);
          return null;
        } finally {
          narratorBusy = false;
        }
      };

      // Stream from Kimi
      const coderStream = this._streamCoder(prompt, context, session);

      // Narration flush timer — every ~2s, convert buffered thoughts
      let narrationInterval;
      const pendingNarrations = [];

      narrationInterval = setInterval(async () => {
        const n = await flushNarration();
        if (n) pendingNarrations.push(n);
      }, 2000);

      try {
        for await (const chunk of coderStream) {
          if (!session.isActive) break;

          // Collect thinking
          if (chunk.thinking) {
            thinkingBuffer += ' ' + chunk.thinking;
            yield {
              type: 'thinking',
              content: chunk.thinking,
              source: 'coder',
              sessionId,
            };
          }

          // Emit code
          if (chunk.code) {
            const parsed = this._parseCodeBlock(chunk.code, currentFile);
            if (parsed.filePath && parsed.filePath !== currentFile) {
              // Yield completed file
              if (currentFile && currentCode) {
                yield {
                  type: 'file-complete',
                  file: currentFile,
                  code: currentCode,
                  sessionId,
                };
              }
              currentFile = parsed.filePath;
              currentCode = '';
              fileIndex++;

              // Action narration — "Creating file X"
              yield {
                type: 'action-narration',
                action: 'create-file',
                text: `Creating ${currentFile}...`,
                sessionId,
              };
            }

            currentCode += parsed.code;
            yield {
              type: 'code',
              content: parsed.code,
              file: currentFile || `file-${fileIndex}`,
              sessionId,
            };
          }

          // Drain any pending narrations
          while (pendingNarrations.length > 0) {
            yield pendingNarrations.shift();
          }
        }
      } finally {
        clearInterval(narrationInterval);
      }

      // Final file
      if (currentFile && currentCode) {
        yield {
          type: 'file-complete',
          file: currentFile,
          code: currentCode,
          sessionId,
        };
      }

      // Final narration flush
      const finalNarration = await flushNarration();
      if (finalNarration) yield finalNarration;

      // Drain remaining
      while (pendingNarrations.length > 0) {
        yield pendingNarrations.shift();
      }

      yield { type: 'vibe-complete', sessionId };
    } catch (err) {
      this.emit('error', { sessionId, error: err.message });
      yield { type: 'error', content: err.message, sessionId };
    } finally {
      session.isActive = false;
      this.activeSessions.delete(sessionId);
      this.emit('session-end', { sessionId });
    }
  }

  /**
   * Stop an active session
   */
  stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) session.isActive = false;
  }

  // ─── Model A: Kimi K2.5 Coder (Ollama streaming) ──────────────────

  /**
   * Stream code generation from the coder model.
   * Extracts thinking/reasoning separately from code output.
   * @yields {{ thinking?: string, code?: string }}
   */
  async *_streamCoder(prompt, context, session) {
    const systemPrompt = `You are an expert full-stack developer. Given a user request, generate production-quality code.

Rules:
- Output files with clear markers: \`\`\`language:filepath
- Think through your approach before coding
- Generate complete, working files
- Use modern best practices

Current project context: ${JSON.stringify(context || {})}`;

    const url = `${this.ollamaUrl}/api/generate`;

    const response = await axios({
      method: 'post',
      url,
      data: {
        model: this.coderModel,
        system: systemPrompt,
        prompt,
        stream: true,
        options: {
          temperature: 0.7,
          num_ctx: 8192,
        },
      },
      responseType: 'stream',
      timeout: 300000,
    });

    let buffer = '';

    for await (const rawChunk of response.data) {
      if (!session.isActive) break;

      buffer += rawChunk.toString();

      // Ollama streams newline-delimited JSON
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        const text = parsed.response || '';
        if (!text) continue;

        // Attempt to split thinking from code.
        // Kimi-style models may use <think>...</think> tags or reasoning_content
        const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          const thinking = thinkMatch[1].trim();
          const code = text.replace(/<think>[\s\S]*?<\/think>/, '').trim();
          if (thinking) yield { thinking };
          if (code) yield { code };
        } else if (parsed.reasoning_content) {
          yield { thinking: parsed.reasoning_content };
          if (text) yield { code: text };
        } else {
          // Heuristic: lines before first code block are thoughts
          yield { code: text };
        }

        if (parsed.done) return;
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.response) yield { code: parsed.response };
      } catch { /* ignore */ }
    }
  }

  // ─── Model B: Local Narrator (Ollama) ──────────────────────────────

  /**
   * Convert dry thinking/reasoning into persona-voiced narration
   * using a lightweight local model.
   */
  async _convertToPersonaVoice(thinking, persona, tone) {
    const personaData = getPersona(persona);

    const narratorPrompt = `${personaData.systemPrompt}

Convert this technical thought into your natural speaking voice.
Keep it conversational, brief (1-2 sentences), as if thinking aloud while coding.
Do NOT use markdown, code blocks, or formatting. Just speak naturally.

Technical thought: "${thinking}"

Respond with ONLY the spoken narration, no quotes, no prefixes.`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.narratorModel,
        prompt: narratorPrompt,
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 120,
        },
      }, { timeout: 30000 });

      return (response.data.response || '').trim() || thinking;
    } catch (err) {
      console.error('[VibeOrchestrator] narrator model error:', err.message);
      // Fallback: return raw thinking
      return thinking;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  /**
   * Parse code blocks from model output.
   * Recognises ```language:filepath patterns.
   */
  _parseCodeBlock(text, currentFile) {
    // Match: ```lang:path or ```path
    const headerMatch = text.match(/```(\w+):([^\n]+)/);
    if (headerMatch) {
      const filePath = headerMatch[2].trim();
      const code = text.replace(/```\w+:[^\n]+\n?/, '').replace(/```\s*$/, '');
      return { filePath, code };
    }

    // Match: // filename: path
    const commentMatch = text.match(/\/\/\s*(?:filename|file):\s*(\S+)/i);
    if (commentMatch) {
      return { filePath: commentMatch[1], code: text };
    }

    // Strip closing ``` if present
    const cleaned = text.replace(/```\s*$/, '');
    return { filePath: currentFile, code: cleaned };
  }
}

module.exports = VibeOrchestrator;

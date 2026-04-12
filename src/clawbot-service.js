/**
 * Clawbot Service — Kimi/Moonshot AI integration for agentic coding
 * Provides streaming code-edit, chat, and skill execution
 */

const axios = require('axios');
require('dotenv').config();

const SYSTEM_PROMPT = `You are an agentic coding assistant integrated into NarratorIDE. \
You can read files, write files, run terminal commands, and reason step-by-step. \
When asked to edit code, think carefully about the changes, explain your reasoning, \
then produce the final result. Always be precise and minimal in your edits.`;

class ClawbotService {
  /**
   * @param {object} [options]
   * @param {string} [options.apiKey]
   * @param {string} [options.model]
   * @param {string} [options.baseUrl]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
    this.model = options.model || process.env.KIMI_MODEL || 'kimi-k2.5';
    this.baseUrl = options.baseUrl || process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
  }

  /**
   * Streaming agentic code edit — async generator yielding chunks
   * @param {string} prompt
   * @param {object} [fileContext] - e.g. { filename, content, language }
   * @yields {{type:'thinking'|'action'|'content'|'done', content?:*}}
   */
  async *agenticCodeEdit(prompt, fileContext) {
    if (!this.apiKey) {
      yield { type: 'content', content: 'Clawbot unavailable: set KIMI_API_KEY or MOONSHOT_API_KEY in your .env file.' };
      yield { type: 'done' };
      return;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (fileContext) {
      messages.push({
        role: 'user',
        content: `Current file: ${fileContext.filename || 'untitled'}\nLanguage: ${fileContext.language || 'unknown'}\n\`\`\`\n${fileContext.content || ''}\n\`\`\``,
      });
    }

    messages.push({ role: 'user', content: prompt });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        { model: this.model, messages, stream: true },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          responseType: 'stream',
          timeout: 120000,
        }
      );
    } catch (err) {
      const msg = err.response ? `API error ${err.response.status}: ${err.response.statusText}` : err.message;
      yield { type: 'content', content: `Clawbot error: ${msg}` };
      yield { type: 'done' };
      return;
    }

    let buffer = '';

    for await (const chunk of response.data) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
        if (!delta) continue;

        // Kimi/Moonshot uses reasoning_content for chain-of-thought
        if (delta.reasoning_content) {
          yield { type: 'thinking', content: delta.reasoning_content };
        }

        if (delta.tool_calls) {
          yield { type: 'action', content: delta.tool_calls };
        }

        if (delta.content) {
          yield { type: 'content', content: delta.content };
        }
      }
    }

    yield { type: 'done' };
  }

  /**
   * Non-streaming chat — returns full response string
   * @param {string} prompt
   * @param {object} [context]
   * @returns {Promise<string>}
   */
  async chat(prompt, context) {
    if (!this.apiKey) {
      return 'Clawbot unavailable: set KIMI_API_KEY or MOONSHOT_API_KEY in your .env file.';
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (context) {
      messages.push({ role: 'user', content: JSON.stringify(context) });
    }

    messages.push({ role: 'user', content: prompt });

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        { model: this.model, messages, stream: false },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (err) {
      const msg = err.response ? `API error ${err.response.status}` : err.message;
      console.error('[Clawbot] chat error:', msg);
      return `Clawbot error: ${msg}`;
    }
  }

  /**
   * Execute a named skill (placeholder for future OpenClaw integration)
   * @param {string} skillName
   * @param {object} [params]
   * @returns {Promise<{success:boolean, result?:*, error?:string}>}
   */
  async executeSkill(skillName, params = {}) {
    console.log(`[Clawbot] executeSkill: ${skillName}`, params);
    return {
      success: false,
      error: `Skill "${skillName}" is not yet implemented. OpenClaw integration coming soon.`,
    };
  }
}

module.exports = ClawbotService;

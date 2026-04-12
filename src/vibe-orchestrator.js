/**
 * Vibe Orchestrator v2 - Multi-Agent Architecture
 * Model A (Kimi K2.5): Generates code, provides raw thinking
 * Model B (Narrator): Converts thinking to persona-voiced responses
 * Key: Dynamic persona switching based on detected language
 */

const { EventEmitter } = require('events');
const axios = require('axios');
const path = require('path');
const { getPersona } = require('./personas');

const AGENT_PERSONAS = {
  javascript: {
    name: 'Jax', displayName: 'Jax (JavaScript)',
    icon: '⚡', color: '#f7df1e', voice: 'energetic',
  },
  typescript: {
    name: 'Alex', displayName: 'Alex (TypeScript)',
    icon: '🔷', color: '#3178c6', voice: 'methodical',
  },
  python: {
    name: 'Sam', displayName: 'Sam (Python)',
    icon: '🐍', color: '#3776ab', voice: 'friendly',
  },
  rust: {
    name: 'Ruby', displayName: 'Ruby (Rust)',
    icon: '🦀', color: '#dea584', voice: 'careful',
  },
  go: {
    name: 'Gordon', displayName: 'Gordon (Go)',
    icon: '🐹', color: '#00add8', voice: 'direct',
  },
  java: {
    name: 'Jay', displayName: 'Jay (Java)',
    icon: '☕', color: '#b07219', voice: 'formal',
  },
  c: {
    name: 'Cecil', displayName: 'Cecil (C)',
    icon: '🔧', color: '#555555', voice: 'wise',
  },
  lisp: {
    name: 'Luna', displayName: 'Luna (Lisp)',
    icon: 'λ', color: '#3fb68b', voice: 'meditative',
  },
};

class VibeOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.coderModel = options.coderModel || process.env.VIBE_CODER_MODEL || process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud';
    this.narratorModel = options.narratorModel || process.env.VIBE_NARRATOR_MODEL || 'qwen2.5:7b';
    this.ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.tts = options.tts || null;
    this.activeSessions = new Map();
  }

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
      currentAgent: null,
      pendingThinking: [],
    };

    this.activeSessions.set(sessionId, session);
    this.emit('session-start', { sessionId, prompt });

    // Send available agents at session start
    yield {
      type: 'agents-available',
      agents: Object.entries(AGENT_PERSONAS).map(([id, p]) => ({
        id, name: p.name, displayName: p.displayName,
        icon: p.icon, color: p.color,
      })),
      sessionId,
    };

    try {
      let thinkingBuffer = '';
      let narratorBusy = false;
      let currentFile = null;
      let currentCode = '';
      let inCodeBlock = false;
      let codeBlockFile = null;

      const flushNarration = async () => {
        if (!thinkingBuffer.trim() || narratorBusy) return null;
        narratorBusy = true;
        const thoughts = thinkingBuffer.trim();
        thinkingBuffer = '';

        try {
          const agentId = session.currentAgent || session.persona;
          const agentInfo = AGENT_PERSONAS[agentId] || AGENT_PERSONAS.javascript;

          const narrationText = await this._convertToPersonaVoice(thoughts, agentId, session.tone);
          let audio = null;
          if (session.enableAudio && this.tts) {
            const buf = await this.tts.synthesize(narrationText, agentId);
            if (buf) audio = buf.toString('base64');
          }
          return {
            type: 'agent-message',
            agent: {
              id: agentId,
              name: agentInfo.name,
              displayName: agentInfo.displayName,
              icon: agentInfo.icon,
              color: agentInfo.color,
            },
            text: narrationText,
            audio,
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

      const coderStream = this._streamCoder(prompt, context, session);

      let narrationInterval;
      const pendingNarrations = [];

      narrationInterval = setInterval(async () => {
        const n = await flushNarration();
        if (n) pendingNarrations.push(n);
      }, 2000);

      let lineBuffer = '';

      try {
        for await (const chunk of coderStream) {
          if (!session.isActive) break;

          if (chunk.thinking) {
            thinkingBuffer += ' ' + chunk.thinking;
            yield {
              type: 'thinking',
              content: chunk.thinking,
              source: 'coder',
              sessionId,
            };
          }

          if (chunk.code) {
            lineBuffer += chunk.code;
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop();

            for (const line of lines) {
              const result = this._processLine(line, currentFile, inCodeBlock, codeBlockFile);

              if (result.fileStart) {
                if (currentFile && currentCode) {
                  yield {
                    type: 'file-complete',
                    file: currentFile,
                    code: currentCode.trimEnd(),
                    language: this._detectLanguage(currentFile),
                    sessionId,
                  };
                }
                currentFile = result.fileStart;
                currentCode = '';
                inCodeBlock = result.inCodeBlock || false;
                codeBlockFile = result.codeBlockFile || null;

                // Detect language and switch agent
                const lang = this._detectLanguage(currentFile);
                if (lang && AGENT_PERSONAS[lang] && lang !== session.currentAgent) {
                  session.currentAgent = lang;
                  yield {
                    type: 'agent-switch',
                    agent: lang,
                    persona: AGENT_PERSONAS[lang],
                    sessionId,
                  };
                }

                yield {
                  type: 'file-start',
                  file: currentFile,
                  language: lang,
                  sessionId,
                };
                continue;
              }

              if (result.fileEnd) {
                if (currentFile && currentCode) {
                  yield {
                    type: 'file-complete',
                    file: currentFile,
                    code: currentCode.trimEnd(),
                    language: this._detectLanguage(currentFile),
                    sessionId,
                  };
                }
                currentFile = null;
                currentCode = '';
                inCodeBlock = result.inCodeBlock || false;
                codeBlockFile = result.codeBlockFile || null;
                continue;
              }

              if (result.inCodeBlock !== undefined) inCodeBlock = result.inCodeBlock;
              if (result.codeBlockFile !== undefined) codeBlockFile = result.codeBlockFile;

              if (result.codeLine !== undefined && currentFile) {
                currentCode += result.codeLine + '\n';
                yield {
                  type: 'code',
                  content: result.codeLine + '\n',
                  file: currentFile,
                  sessionId,
                };
              } else if (result.codeLine !== undefined && !currentFile) {
                if (result.codeLine.trim()) {
                  thinkingBuffer += ' ' + result.codeLine;
                }
              }
            }
          }

          while (pendingNarrations.length > 0) {
            yield pendingNarrations.shift();
          }
        }

        if (lineBuffer.trim() && currentFile) {
          currentCode += lineBuffer;
          yield {
            type: 'code',
            content: lineBuffer,
            file: currentFile,
            sessionId,
          };
        }
      } finally {
        clearInterval(narrationInterval);
      }

      if (currentFile && currentCode) {
        yield {
          type: 'file-complete',
          file: currentFile,
          code: currentCode.trimEnd(),
          language: this._detectLanguage(currentFile),
          sessionId,
        };
      }

      const finalNarration = await flushNarration();
      if (finalNarration) yield finalNarration;

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

  stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) session.isActive = false;
  }

  // ─── Model A: Kimi K2.5 Coder (Ollama streaming) ──────────────────

  async *_streamCoder(prompt, context, session) {
    const systemPrompt = `You are an expert full-stack developer. Given a user request, generate production-quality code.

CRITICAL OUTPUT FORMAT RULES:
1. Output EACH file with a clear header line: ===FILE:filepath===
2. End each file with a line: ===ENDFILE===
3. Include the full relative file path (e.g., ===FILE:src/components/TodoList.jsx===)
4. Generate ALL necessary files for a working application
5. Do NOT wrap code in markdown code blocks (\`\`\`)

Example output format:
===FILE:package.json===
{
  "name": "my-app",
  "dependencies": {}
}
===ENDFILE===

===FILE:src/App.jsx===
import React from 'react';
export default function App() { return <div>Hello</div>; }
===ENDFILE===

Think through your approach before outputting files.

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
          num_ctx: 16384,
        },
      },
      responseType: 'stream',
      timeout: 600000,
    });

    let buffer = '';

    for await (const rawChunk of response.data) {
      if (!session.isActive) break;

      buffer += rawChunk.toString();

      const lines = buffer.split('\n');
      buffer = lines.pop();

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

        const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          const thinking = thinkMatch[1].trim();
          const remainder = text.replace(/<think>[\s\S]*?<\/think>/, '');
          if (thinking) yield { thinking };
          if (remainder.trim()) yield { code: remainder };
        } else if (parsed.reasoning_content) {
          yield { thinking: parsed.reasoning_content };
          if (text) yield { code: text };
        } else {
          yield { code: text };
        }

        if (parsed.done) return;
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.response) yield { code: parsed.response };
      } catch { /* ignore */ }
    }
  }

  // ─── Model B: Local Narrator (Ollama) ──────────────────────────────

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
      return thinking;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  _detectLanguage(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    const map = {
      '.js': 'javascript', '.jsx': 'javascript',
      '.ts': 'typescript', '.tsx': 'typescript',
      '.py': 'python', '.rs': 'rust', '.go': 'go',
      '.java': 'java', '.c': 'c', '.cpp': 'c',
      '.html': 'html', '.css': 'css', '.json': 'json',
      '.md': 'markdown', '.sh': 'bash',
    };
    return map[ext] || 'javascript';
  }

  _processLine(line, currentFile, inCodeBlock, codeBlockFile) {
    const trimmed = line.trim();

    const fileHeaderMatch = trimmed.match(/^={2,}FILE:\s*(.+?)={2,}\s*$/);
    if (fileHeaderMatch) {
      return {
        fileStart: fileHeaderMatch[1].trim(),
        inCodeBlock: false,
        codeBlockFile: null,
      };
    }

    if (/^={2,}ENDFILE={2,}\s*$/.test(trimmed)) {
      return {
        fileEnd: true,
        inCodeBlock: false,
        codeBlockFile: null,
      };
    }

    const codeBlockStart = trimmed.match(/^```(\w+):(.+)$/);
    if (codeBlockStart) {
      return {
        fileStart: codeBlockStart[2].trim(),
        inCodeBlock: true,
        codeBlockFile: codeBlockStart[2].trim(),
      };
    }

    if (inCodeBlock && /^```\s*$/.test(trimmed)) {
      return {
        fileEnd: true,
        inCodeBlock: false,
        codeBlockFile: null,
      };
    }

    if (!currentFile) {
      const commentMatch = trimmed.match(/^(?:\/\/|#)\s*(?:File|filename):\s*(\S+)/i);
      if (commentMatch) {
        return {
          fileStart: commentMatch[1].trim(),
          inCodeBlock: false,
          codeBlockFile: null,
        };
      }
    }

    return { codeLine: line };
  }
}

module.exports = { VibeOrchestrator, AGENT_PERSONAS };

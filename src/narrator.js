/**
 * Core narration engine
 * Handles code change detection, LLM processing, and TTS narration
 */

const { EventEmitter } = require('events');
const { getPersona, getTone } = require('./personas');
const { generateNarration: generateNarrationLLM } = require('./llm-provider');

class Narrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.currentLanguage = 'javascript';
    this.currentTone = 'casual';
    this.narratedChanges = new Set(); // Track what we've narrated to avoid repeats
    this.isNarrating = false;
    /** @type {Map<string, string>} */
    this.files = new Map(); // Store current state of multiple files
  }

  /**
   * Update internal state of a file
   */
  updateFile(filename, content) {
    if (filename) {
      this.files.set(filename, content);
    }
  }

  /**
   * Get project-wide context for the LLM
   */
  getProjectContext(currentFile = '') {
    let context = 'Project Context (other files):\n';
    let count = 0;
    for (const [filename, content] of this.files) {
      if (filename !== currentFile) {
        context += `--- ${filename} ---\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}\n\n`;
        count++;
      }
      if (count >= 5) break; // Limit context
    }
    return count > 0 ? context : '';
  }

  /**
   * Detect programming language from file content
   */
  detectLanguage(code, filename = '') {
    // Map file extensions to languages
    const extensionMap = {
      '.rs': 'rust',
      '.go': 'go',
      '.py': 'python',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.c': 'c',
      '.java': 'java',
      '.cl': 'lisp',
      '.lisp': 'lisp',
    };

    // Check extension first
    for (const [ext, lang] of Object.entries(extensionMap)) {
      if (filename.endsWith(ext)) {
        return lang;
      }
    }

    // Fallback: detect from code patterns
    if (code.includes('fn ') && code.includes('let ')) return 'rust';
    if (code.includes('func ') && code.includes('package ')) return 'go';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('public class ')) return 'java';
    if (code.includes('(defun') || code.includes('(let')) return 'lisp';
    if (code.includes('#include')) return 'c';

    return 'javascript'; // default
  }

  /**
   * Build the system prompt for the narrator
   */
  buildSystemPrompt() {
    const persona = getPersona(this.currentLanguage);
    const tone = getTone(this.currentTone);

    return `${persona.systemPrompt}

Additional tone direction: ${tone.styleGuide}

You are narrating code changes as they happen. Keep narrations to 1-3 sentences, punchy and engaging.
Focus on WHAT changed and WHY it matters for the overall project.
Stay in character. Be the voice of ${this.currentLanguage}.`;
  }

  /**
   * Generate narration for a code change
   */
  async narrate(codeChange, context = {}) {
    if (this.isNarrating) {
      console.log('Already narrating, queueing request...');
      return;
    }

    this.isNarrating = true;
    const changeHash = JSON.stringify(codeChange.after).substring(0, 50);

    if (this.narratedChanges.has(changeHash)) {
      this.isNarrating = false;
      return; // Already narrated this change
    }

    try {
      // Detect language if not specified
      if (context.language) {
        this.currentLanguage = context.language;
      } else if (context.filename) {
        this.currentLanguage = this.detectLanguage(codeChange.after, context.filename);
      }

      // Use specified tone or default
      if (context.tone) {
        this.currentTone = context.tone;
      }

      // Project context
      const projectContext = this.getProjectContext(context.filename);
      const enhancedCodeChange = {
        ...codeChange,
        projectContext
      };

      // Generate narration via multi-LLM provider
      const narration = await generateNarrationLLM(
        enhancedCodeChange,
        this.currentLanguage,
        this.currentTone
      );

      this.narratedChanges.add(changeHash);
      this.emit('narration', {
        text: narration,
        language: this.currentLanguage,
        tone: this.currentTone,
        timestamp: new Date()
      });

      return narration;
    } catch (error) {
      console.error('Error generating narration:', error);
      this.emit('error', error);
    } finally {
      this.isNarrating = false;
    }
  }

  /**
   * Handle incoming code changes from editor
   */
  async onCodeChange(change) {
    this.updateFile(change.filename, change.currentText);

    const codeChange = {
      before: change.previousText || '',
      after: change.currentText || '',
      summary: `Modified ${change.linesChanged || 'some'} lines in ${change.filename || 'code'}`
    };

    const narration = await this.narrate(codeChange, {
      filename: change.filename,
      tone: this.currentTone
    });

    return narration;
  }

  /**
   * Change the narrative persona
   */
  setPersona(language) {
    if (language in require('./personas').PERSONAS) {
      this.currentLanguage = language;
      this.emit('persona-changed', {
        language,
        persona: getPersona(language)
      });
      return true;
    }
    return false;
  }

  /**
   * Change the narrative tone
   */
  setTone(tone) {
    if (tone in require('./personas').TONES) {
      this.currentTone = tone;
      this.emit('tone-changed', { tone });
      return true;
    }
    return false;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      language: this.currentLanguage,
      tone: this.currentTone,
      persona: getPersona(this.currentLanguage),
      isNarrating: this.isNarrating
    };
  }

  /**
   * Clear narration history (for new session)
   */
  clearHistory() {
    this.narratedChanges.clear();
    this.emit('history-cleared');
  }
}

module.exports = Narrator;

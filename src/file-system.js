/**
 * File System Manager for NarratorIDE
 * Provides sandboxed file operations for the browser IDE
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/** Map file extensions to language identifiers */
const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.c': 'c',
  '.java': 'java',
  '.lisp': 'lisp',
  '.cl': 'lisp',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.md': 'markdown',
  '.sh': 'bash',
};

/** Directories and files to exclude from listings */
const IGNORED = new Set(['node_modules', '.git', '.DS_Store']);

class FileSystemManager extends EventEmitter {
  /**
   * @param {string} [workspaceRoot] - Absolute path to workspace root (defaults to cwd)
   */
  constructor(workspaceRoot) {
    super();
    this.workspaceRoot = workspaceRoot || process.cwd();
    /** @type {Map<string, fs.FSWatcher>} */
    this._watchers = new Map();
  }

  // ─── Path helpers ──────────────────────────────────────────────────

  /**
   * Resolve a relative path against the workspace root and ensure it stays inside
   * @param {string} relativePath
   * @returns {string} absolute path
   */
  _resolve(relativePath) {
    const resolved = path.resolve(this.workspaceRoot, relativePath || '.');
    if (!resolved.startsWith(this.workspaceRoot)) {
      throw new Error('Access denied: path is outside workspace root');
    }
    return resolved;
  }

  /**
   * Detect language from a file extension
   * @param {string} filePath
   * @returns {string|undefined}
   */
  _detectLanguage(filePath) {
    return LANGUAGE_MAP[path.extname(filePath).toLowerCase()];
  }

  // ─── Directory operations ──────────────────────────────────────────

  /**
   * List the contents of a directory
   * @param {string} [relativePath='.'] - relative to workspace root
   * @returns {Promise<Array<{name:string, path:string, type:'file'|'directory', size:number, modified:string, language?:string}>>}
   */
  async listDirectory(relativePath = '.') {
    const absPath = this._resolve(relativePath);
    const entries = await fs.readdir(absPath, { withFileTypes: true });

    const results = [];
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;

      const entryAbs = path.join(absPath, entry.name);
      const stat = await fs.stat(entryAbs).catch(() => null);
      if (!stat) continue;

      const item = {
        name: entry.name,
        path: path.relative(this.workspaceRoot, entryAbs),
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };

      if (item.type === 'file') {
        const lang = this._detectLanguage(entry.name);
        if (lang) item.language = lang;
      }

      results.push(item);
    }

    return results;
  }

  /**
   * Build a recursive tree starting from relativePath
   * @param {string} [relativePath='.']
   * @returns {Promise<object>}
   */
  async getTree(relativePath = '.') {
    const absPath = this._resolve(relativePath);
    const stat = await fs.stat(absPath);

    const node = {
      name: path.basename(absPath),
      path: path.relative(this.workspaceRoot, absPath),
      type: stat.isDirectory() ? 'directory' : 'file',
      size: stat.size,
      modified: stat.mtime.toISOString(),
    };

    if (stat.isDirectory()) {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      node.children = [];
      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue;
        const childRel = path.join(relativePath, entry.name);
        node.children.push(await this.getTree(childRel));
      }
    } else {
      const lang = this._detectLanguage(absPath);
      if (lang) node.language = lang;
    }

    return node;
  }

  // ─── File operations ───────────────────────────────────────────────

  /**
   * Read a file and return its content with metadata
   * @param {string} relativePath
   * @returns {Promise<{content:string, language?:string, size:number}>}
   */
  async readFile(relativePath) {
    const absPath = this._resolve(relativePath);
    const [content, stat] = await Promise.all([
      fs.readFile(absPath, 'utf-8'),
      fs.stat(absPath),
    ]);

    return {
      content,
      language: this._detectLanguage(absPath),
      size: stat.size,
    };
  }

  /**
   * Write content to an existing or new file
   * @param {string} relativePath
   * @param {string} content
   * @returns {Promise<{success:boolean, path:string}>}
   */
  async writeFile(relativePath, content) {
    const absPath = this._resolve(relativePath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf-8');
    return { success: true, path: relativePath };
  }

  /**
   * Create a new file (optionally with initial content)
   * @param {string} relativePath
   * @param {string} [content='']
   * @returns {Promise<{success:boolean, path:string}>}
   */
  async createFile(relativePath, content = '') {
    const absPath = this._resolve(relativePath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf-8');
    return { success: true, path: relativePath };
  }

  /**
   * Create a directory (recursively)
   * @param {string} relativePath
   * @returns {Promise<{success:boolean, path:string}>}
   */
  async createDirectory(relativePath) {
    const absPath = this._resolve(relativePath);
    await fs.mkdir(absPath, { recursive: true });
    return { success: true, path: relativePath };
  }

  /**
   * Delete a file or directory
   * @param {string} relativePath
   * @returns {Promise<{success:boolean}>}
   */
  async deleteFile(relativePath) {
    const absPath = this._resolve(relativePath);
    const stat = await fs.stat(absPath);
    if (stat.isDirectory()) {
      await fs.rm(absPath, { recursive: true, force: true });
    } else {
      await fs.unlink(absPath);
    }
    return { success: true };
  }

  /**
   * Rename or move a file/directory
   * @param {string} oldPath - relative
   * @param {string} newPath - relative
   * @returns {Promise<{success:boolean}>}
   */
  async rename(oldPath, newPath) {
    const absOld = this._resolve(oldPath);
    const absNew = this._resolve(newPath);
    await fs.mkdir(path.dirname(absNew), { recursive: true });
    await fs.rename(absOld, absNew);
    return { success: true };
  }

  // ─── File watching ─────────────────────────────────────────────────

  /**
   * Start watching the workspace root for file changes
   */
  startWatching() {
    if (this._watchers.has(this.workspaceRoot)) return;

    try {
      const watcher = fsSync.watch(
        this.workspaceRoot,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) return;
          const parts = filename.split(path.sep);
          if (parts.some((p) => IGNORED.has(p))) return;

          this.emit('file-changed', {
            eventType,
            path: filename,
            language: this._detectLanguage(filename),
            timestamp: new Date().toISOString(),
          });
        }
      );

      watcher.on('error', (err) => {
        console.error('[FileSystem] Watch error:', err.message);
      });

      this._watchers.set(this.workspaceRoot, watcher);
      console.log(`[FileSystem] Watching ${this.workspaceRoot}`);
    } catch (err) {
      console.error('[FileSystem] Failed to start watcher:', err.message);
    }
  }

  /**
   * Stop watching for file changes
   */
  stopWatching() {
    for (const [key, watcher] of this._watchers) {
      watcher.close();
      this._watchers.delete(key);
    }
    console.log('[FileSystem] Stopped watching');
  }
}

module.exports = FileSystemManager;

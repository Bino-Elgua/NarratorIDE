/**
 * Git Manager for NarratorIDE
 * Provides git status and diff information for narration
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');

class GitManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  /**
   * Check if the workspace is a git repository
   */
  async isRepo() {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspaceRoot });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch name
   */
  async getBranch() {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: this.workspaceRoot });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get git status
   */
  async getStatus() {
    try {
      const { stdout } = await execAsync('git status --short', { cwd: this.workspaceRoot });
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Get diff for a specific file
   * @param {string} relativePath
   */
  async getDiff(relativePath) {
    try {
      const { stdout } = await execAsync(`git diff --unified=0 "${relativePath}"`, { cwd: this.workspaceRoot });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get staged diff for a specific file
   * @param {string} relativePath
   */
  async getStagedDiff(relativePath) {
    try {
      const { stdout } = await execAsync(`git diff --cached --unified=0 "${relativePath}"`, { cwd: this.workspaceRoot });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get summary of all changes
   */
  async getSummary() {
    try {
      const branch = await this.getBranch();
      const status = await this.getStatus();
      return {
        branch,
        modifiedCount: status.length,
        status: status.slice(0, 10), // Limit to top 10 files
      };
    } catch {
      return null;
    }
  }
}

module.exports = GitManager;

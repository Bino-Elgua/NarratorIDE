/**
 * Analytics Service for NarratorIDE
 * Tracks usage metrics for sessions, narrations, and errors
 */

const fs = require('fs');
const path = require('path');

class AnalyticsService {
  constructor(logPath) {
    this.logPath = logPath || path.join(__dirname, '../analytics.json');
    this.stats = {
      startTime: new Date().toISOString(),
      narrationCount: 0,
      thinkingSessionCount: 0,
      terminalSessionCount: 0,
      errorCount: 0,
      personaUsage: {},
      toneUsage: {},
      languageUsage: {},
    };
    this.load();
  }

  trackNarration(persona, tone, language) {
    this.stats.narrationCount++;
    this.stats.personaUsage[persona] = (this.stats.personaUsage[persona] || 0) + 1;
    this.stats.toneUsage[tone] = (this.stats.toneUsage[tone] || 0) + 1;
    this.stats.languageUsage[language] = (this.stats.languageUsage[language] || 0) + 1;
    this.save();
  }

  trackThinkingSession() {
    this.stats.thinkingSessionCount++;
    this.save();
  }

  trackTerminalSession() {
    this.stats.terminalSessionCount++;
    this.save();
  }

  trackError(type) {
    this.stats.errorCount++;
    this.save();
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Math.floor((new Date() - new Date(this.stats.startTime)) / 1000),
    };
  }

  save() {
    try {
      fs.writeFileSync(this.logPath, JSON.stringify(this.stats, null, 2));
    } catch (e) {
      console.error('[Analytics] Save failed:', e.message);
    }
  }

  load() {
    if (fs.existsSync(this.logPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));
        this.stats = { ...this.stats, ...data };
      } catch (e) {
        console.error('[Analytics] Load failed:', e.message);
      }
    }
  }
}

module.exports = AnalyticsService;

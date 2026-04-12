/**
 * Narrator IDE Server v2.0
 * Full browser IDE with Monaco, Terminal, Narration, Clawbot, and Thinking
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
require('dotenv').config();

const Narrator = require('./narrator');
const TTSEngine = require('./tts');
const FileSystemManager = require('./file-system');
const TerminalManager = require('./terminal-manager');
const GitManager = require('./git-manager');
const AnalyticsService = require('./analytics-service');
const ClawbotService = require('./clawbot-service');
const ThinkingNarrator = require('./thinking-narrator');
const WebSocketHandler = require('./websocket-handler');
const { PERSONAS, TONES, getPersona, getTone } = require('./personas');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());

// Determine workspace root (configurable via env)
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

// Auth Middleware (Phase 4)
const authMiddleware = (req, res, next) => {
  const apiKey = process.env.APP_API_KEY;
  if (!apiKey) return next(); // No key set, allow all

  const providedKey = req.headers['x-api-key'] || req.query.api_key;
  if (providedKey !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

app.use('/api', authMiddleware);

// Initialize services
const narrator = new Narrator();
const tts = new TTSEngine();
const fileSystem = new FileSystemManager(WORKSPACE_ROOT);
const terminalManager = new TerminalManager();
const gitManager = new GitManager(WORKSPACE_ROOT);
const analytics = new AnalyticsService();
const clawbotService = new ClawbotService();
const personaEngine = { getPersona, getTone };
const thinkingNarrator = new ThinkingNarrator(clawbotService, tts, personaEngine);

// Initialize centralized WebSocket handler
const wsHandler = new WebSocketHandler(
  wss, narrator, tts, fileSystem, terminalManager, gitManager, analytics, clawbotService, thinkingNarrator
);

// Start file watching
fileSystem.startWatching();

// Serve IDE as default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/ide.html'));
});

// Serve legacy UI at /classic
app.get('/classic', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/index-modern.html'));
});

// Static files
app.use(express.static(path.join(__dirname, '../web')));

// ── REST API ────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    clients: wsHandler.clients.size,
    currentLanguage: narrator.currentLanguage,
    currentTone: narrator.currentTone,
    workspace: WORKSPACE_ROOT
  });
});

app.get('/api/personas', (req, res) => {
  res.json(Object.entries(PERSONAS).map(([key, persona]) => ({
    id: key,
    name: persona.name,
    language: persona.language,
    voice: persona.voice
  })));
});

app.get('/api/tones', (req, res) => {
  res.json(Object.entries(TONES).map(([key, tone]) => ({
    id: key,
    name: tone.name,
    description: tone.description
  })));
});

app.get('/api/state', (req, res) => {
  res.json(narrator.getState());
});

app.get('/api/providers', (req, res) => {
  res.json({
    current: process.env.LLM_PROVIDER || 'claude',
    available: ['claude', 'ollama', 'hf', 'grok', 'kimi'],
    clawbot: !!clawbotService.apiKey
  });
});

app.get('/api/analytics', (req, res) => {
  res.json(analytics.getStats());
});

app.post('/api/narrate', async (req, res) => {
  const { text, language } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const audioBuffer = await tts.synthesize(text, language || narrator.currentLanguage);
    if (audioBuffer) {
      res.set('Content-Type', 'audio/mpeg');
      res.send(audioBuffer);
    } else {
      res.json({ message: 'TTS not configured, text-only mode' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File system REST endpoints
app.get('/api/files', async (req, res) => {
  try {
    const tree = await fileSystem.getTree(req.query.path || '.');
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/read', async (req, res) => {
  try {
    const result = await fileSystem.readFile(req.query.path);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Cleanup ─────────────────────────────────────────────────

function cleanup() {
  console.log('\n🛑 Shutting down...');
  fileSystem.stopWatching();
  terminalManager.destroyAll();
  server.close();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ── Start ───────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✨ NarratorIDE v2.0 running on http://localhost:${PORT}`);
  console.log(`🎙️  WebSocket: ws://localhost:${PORT}`);
  console.log(`📂 Workspace: ${WORKSPACE_ROOT}`);
  console.log(`📚 Personas: ${Object.keys(PERSONAS).join(', ')}`);
  console.log(`🎨 Tones: ${Object.keys(TONES).join(', ')}`);
  console.log(`🤖 Clawbot: ${clawbotService.apiKey ? 'enabled' : 'no API key — disabled'}`);
  console.log(`🔊 TTS: ${tts.apiKey ? 'ElevenLabs' : 'browser SpeechSynthesis fallback'}\n`);
});

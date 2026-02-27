/**
 * Narrator IDE Server
 * Runs the narration engine and handles communication with VSCode extension
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const os = require('os');
require('dotenv').config();

const Narrator = require('./narrator');
const TTSEngine = require('./tts');
const { getPersona, getTone, PERSONAS, TONES } = require('./personas');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));

// Initialize engines
const narrator = new Narrator();
const tts = new TTSEngine();

// Track active clients
const clients = new Map();
const terminalProcesses = new Map();

// Initialize a shell process for a client
function createTerminal(clientId) {
  if (terminalProcesses.has(clientId)) {
    return terminalProcesses.get(clientId);
  }

  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  const shellArgs = os.platform() === 'win32' ? [] : ['--norc'];

  const proc = spawn(shell, shellArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const terminal = {
    process: proc,
    clientId,
    write: (data) => {
      if (proc.stdin.writable) {
        proc.stdin.write(data);
      }
    }
  };

  // Handle output
  proc.stdout.on('data', (data) => {
    const client = clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'terminal-output',
        data: data.toString()
      }));
    }
  });

  proc.stderr.on('data', (data) => {
    const client = clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'terminal-output',
        data: '\x1b[38;5;196m' + data.toString() + '\x1b[0m'
      }));
    }
  });

  proc.on('close', () => {
    terminalProcesses.delete(clientId);
  });

  terminalProcesses.set(clientId, terminal);
  return terminal;
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);

  console.log(`[${clientId}] Client connected. Total: ${clients.size}`);

  // Create terminal for this client
  createTerminal(clientId);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      await handleMessage(clientId, message, ws);
    } catch (error) {
      console.error('Message handling error:', error);
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    const terminal = terminalProcesses.get(clientId);
    if (terminal) {
      terminal.process.kill();
      terminalProcesses.delete(clientId);
    }
    console.log(`[${clientId}] Client disconnected. Total: ${clients.size}`);
  });

  // Send initial state
  ws.send(JSON.stringify({
    type: 'state',
    data: narrator.getState()
  }));
});

/**
 * Handle incoming messages from clients
 */
async function handleMessage(clientId, message, ws) {
  switch (message.type) {
    case 'code-change':
      await handleCodeChange(clientId, message, ws);
      break;

    case 'set-persona':
      handleSetPersona(clientId, message, ws);
      break;

    case 'set-tone':
      handleSetTone(clientId, message, ws);
      break;

    case 'get-state':
      ws.send(JSON.stringify({
        type: 'state',
        data: narrator.getState()
      }));
      break;

    case 'get-personas':
      ws.send(JSON.stringify({
        type: 'personas',
        data: Object.entries(PERSONAS).map(([key, persona]) => ({
          id: key,
          name: persona.name,
          language: persona.language
        }))
      }));
      break;

    case 'get-tones':
      ws.send(JSON.stringify({
        type: 'tones',
        data: Object.entries(TONES).map(([key, tone]) => ({
          id: key,
          name: tone.name,
          description: tone.description
        }))
      }));
      break;

    case 'clear-history':
      narrator.clearHistory();
      broadcast({
        type: 'history-cleared'
      });
      break;

    case 'terminal-input':
      handleTerminalInput(clientId, message);
      break;

    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

/**
 * Handle terminal input
 */
function handleTerminalInput(clientId, message) {
  const terminal = terminalProcesses.get(clientId);
  if (terminal && message.data) {
    terminal.write(message.data);
  }
}

/**
 * Handle code change narration
 */
async function handleCodeChange(clientId, message, ws) {
  const { code, language, filename, tone } = message;

  // Extract the change (detect diff)
  const codeChange = {
    before: message.previousCode || '',
    after: code,
    summary: message.summary || `Updated ${filename || 'code'}`
  };

  // Generate narration
  const narration = await narrator.narrate(codeChange, {
    filename,
    language: language || undefined,
    tone: tone || narrator.currentTone
  });

  if (!narration) {
    return;
  }

  // Generate audio
  const audioBuffer = await tts.synthesize(narration, narrator.currentLanguage);

  // Broadcast to all clients
  broadcast({
    type: 'narration',
    data: {
      text: narration,
      language: narrator.currentLanguage,
      tone: narrator.currentTone,
      persona: getPersona(narrator.currentLanguage),
      audio: audioBuffer ? audioBuffer.toString('base64') : null,
      timestamp: new Date()
    }
  });
}

/**
 * Handle persona change
 */
function handleSetPersona(clientId, message, ws) {
  const { language } = message;
  if (narrator.setPersona(language)) {
    broadcast({
      type: 'persona-changed',
      data: {
        language,
        persona: getPersona(language)
      }
    });
  } else {
    ws.send(JSON.stringify({
      type: 'error',
      error: `Unknown language: ${language}`
    }));
  }
}

/**
 * Handle tone change
 */
function handleSetTone(clientId, message, ws) {
  const { tone } = message;
  if (narrator.setTone(tone)) {
    broadcast({
      type: 'tone-changed',
      data: { tone }
    });
  } else {
    ws.send(JSON.stringify({
      type: 'error',
      error: `Unknown tone: ${tone}`
    }));
  }
}

/**
 * Broadcast message to all connected clients
 */
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// REST endpoints
app.get('/api/state', (req, res) => {
  res.json(narrator.getState());
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

app.post('/api/narrate', async (req, res) => {
  const { text, language } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text required' });
  }

  try {
    const audioBuffer = await tts.synthesize(text, language || narrator.currentLanguage);
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: clients.size,
    currentLanguage: narrator.currentLanguage,
    currentTone: narrator.currentTone
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✨ Narrator IDE Server running on http://localhost:${PORT}`);
  console.log(`🎙️  WebSocket connections: ws://localhost:${PORT}`);
  console.log(`📚 Available personas: ${Object.keys(PERSONAS).join(', ')}`);
  console.log(`🎨 Available tones: ${Object.keys(TONES).join(', ')}`);
});

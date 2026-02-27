# 🎙️ Narrator IDE

**Multi-LLM AI Code Narration Engine** — Real-time narration of your coding process with language-specific personas and customizable tones. Switch between Claude, Ollama, HuggingFace, and Grok on the fly.

Instead of sitting around waiting for code, a narrator agent speaks the story of what's happening in real-time. Toggle between tones and personas mid-session, all from a beautiful responsive web interface or VSCode extension.

---

## ✨ Key Features

### 🎯 Language-Specific Personas (8 Total)
- **Rust**: The Meticulous Engineer (careful, safety-obsessed, pedantic)
- **Go**: The Pragmatist (fast, direct, no-nonsense)
- **Python**: The Gen-Z Creative (expressive, accessible, enthusiastic)
- **JavaScript**: The Chaos Agent (fast, opinionated, irreverent)
- **C**: The Elder Craftsman (wise, careful, grim)
- **Java**: The Corporate Consultant (formal, enterprise-minded)
- **Lisp**: The Philosopher (meditative, abstract, contemplative)
- **TypeScript**: The Careful Editor (methodical, reassuring, precise)

### 🎨 Tone Styles (7 Total)
- **Academic** — Formal, research-oriented, technical depth
- **Casual** — Conversational, friendly, approachable
- **Playful** — Fun, humorous, entertaining
- **Verbose** — Detailed explanations, comprehensive
- **Concise** — Brief, to-the-point, efficient
- **Encouraging** — Positive, supportive, motivational
- **Brutal** — Honest criticism, blunt, unfiltered

### 🧠 Multi-LLM Backend
- **Claude** (Anthropic) — Default, highest quality
- **Ollama** (Local) — Free, runs on your machine
- **HuggingFace** — Cheap inference, diverse models
- **Grok** (xAI) — New, experimental, high-speed
- **Automatic Fallback** — Seamlessly switches providers if one fails

### 🔊 Real-Time Narration
- Detects code changes as you type
- Generates narration with selected LLM
- Text-to-speech synthesis (if enabled)
- Plays back automatically
- Live history of all narrations

### 🎮 Interactive Controls
- Toggle narration on/off instantly
- Switch personas/tones on-the-fly
- View live narration history
- Monitor connection status
- Keyboard shortcuts support

### 📱 Responsive Web UI
- Mobile-first design (works on phone/tablet/desktop)
- Dark theme by default
- Real-time metrics dashboard
- WebSocket live updates
- Settings panel for configuration

### 🔌 VSCode Extension
- Narrate code as you edit
- Sidebar control panel
- Inline narration indicators
- Keyboard shortcuts

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- One LLM provider API key (or Ollama running locally)

### 1. Setup & Install

```bash
cd narrator-ide
npm install
cp .env.example .env
```

### 2. Configure LLM Provider

Edit `.env` and choose one:

**Option A: Claude (Recommended)**
```env
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Option B: Ollama (Free, Local)**
```env
LLM_PROVIDER=ollama
OLLAMA_API_URL=http://localhost:11434
```
Then run: `ollama serve` in another terminal

**Option C: HuggingFace (Cheap)**
```env
LLM_PROVIDER=hf
HF_TOKEN=hf_your-token-here
```

**Option D: Grok (New)**
```env
LLM_PROVIDER=grok
XAI_API_KEY=xai-your-key-here
```

### 3. Start the Server

```bash
npm start
```

Server runs on: **http://localhost:3000**

### 4. Open in Browser

Visit: **http://localhost:3000**

Paste code, select persona & tone, click "Narrate" and listen!

---

## 📊 System Architecture

```
narrator-ide/
├── src/
│   ├── server.js              # Express + WebSocket server
│   ├── llm-provider.js        # Multi-LLM router (core)
│   ├── personas.js            # 8 personas + 7 tones
│   ├── narrator.js            # Narration engine
│   ├── tts.js                 # Text-to-speech (optional)
│   └── voice-router.js        # Voice selection logic
├── web/
│   ├── index.html             # Mobile-first UI
│   ├── css/style.css          # Responsive design
│   └── js/
│       ├── app.js             # Main app logic
│       ├── websocket.js       # Real-time connection
│       └── ui.js              # UI components
├── vscode-extension/          # VSCode integration
│   ├── src/
│   │   ├── extension.ts       # Extension entry
│   │   ├── narrator-client.ts # WebSocket client
│   │   └── sidebar.ts         # Control panel
│   └── package.json
├── .env.example               # Environment template
├── package.json
├── QUICK_REFERENCE.md         # 1-minute setup
├── MULTI_LLM_INTEGRATION.md   # Provider details
└── README.md                  # This file
```

### Service Architecture

```
┌─────────────────────────────────┐
│   User (Browser/VSCode)         │
└────────────┬────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   Narrator IDE Server            │
│   ├─ WebSocket Handler           │
│   ├─ REST API Endpoints          │
│   └─ Narration Engine            │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   LLM Provider Router            │
│   ├─ Claude (default)            │
│   ├─ Ollama (fallback 1)        │
│   ├─ HuggingFace (fallback 2)   │
│   └─ Grok (fallback 3)          │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   Selected LLM Backend           │
│   (Claude / Ollama / HF / Grok)  │
└──────────────────────────────────┘
```

---

## 🔌 API Reference

### WebSocket Messages

**Client → Server: Send Code for Narration**
```json
{
  "type": "narrate",
  "code": "const fibonacci = (n) => n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2);",
  "language": "javascript",
  "filename": "math.js",
  "persona": "javascript",
  "tone": "playful"
}
```

**Client → Server: Change Persona**
```json
{
  "type": "set-persona",
  "persona": "rust"
}
```

**Client → Server: Change Tone**
```json
{
  "type": "set-tone",
  "tone": "verbose"
}
```

**Server → Client: Narration Result**
```json
{
  "type": "narration",
  "data": {
    "text": "Yo, you're building a recursive fibonacci function here. Nice try, but... this is gonna be SLOW on large numbers because you're recalculating everything. Your complexity is exponential, my friend.",
    "language": "javascript",
    "tone": "playful",
    "persona": "javascript",
    "audioUrl": "data:audio/mp3;base64,..."
  }
}
```

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/personas` | List all personas |
| `GET` | `/api/tones` | List all tones |
| `GET` | `/api/state` | Current configuration |
| `POST` | `/api/narrate` | Narrate text (REST) |
| `GET` | `/api/providers` | Available LLM providers |

**POST /api/narrate Example**
```bash
curl -X POST http://localhost:3000/api/narrate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function hello() { return 42; }",
    "language": "javascript",
    "persona": "javascript",
    "tone": "casual"
  }'
```

---

## 🛠️ Configuration

### LLM Providers Comparison

| Provider | Cost | Speed | Quality | Setup | Command |
|----------|------|-------|---------|-------|---------|
| Claude | $$$ | 1-3s | ⭐⭐⭐⭐⭐ | Easy | `npm start` |
| Ollama | FREE | Instant | ⭐⭐⭐⭐ | Medium | `ollama serve` + `npm start` |
| HuggingFace | $ | 2-5s | ⭐⭐⭐⭐ | Easy | `npm start` |
| Grok | TBD | 1-3s | ⭐⭐⭐⭐⭐ | Easy | `npm start` |

### Environment Variables

```env
# LLM Provider (required)
LLM_PROVIDER=claude              # claude | ollama | hf | grok

# API Keys (depends on provider)
ANTHROPIC_API_KEY=sk-ant-...     # For Claude
HF_TOKEN=hf_...                  # For HuggingFace
XAI_API_KEY=xai-...              # For Grok
OLLAMA_API_URL=http://localhost:11434  # For Ollama

# Server Configuration
PORT=3000
NODE_ENV=development             # development | production

# Optional: Text-to-Speech
ELEVENLABS_API_KEY=sk_...        # For audio synthesis
ELEVENLABS_ENABLED=true
```

### Switching Providers (No Restart)

1. Edit `.env`
2. Change `LLM_PROVIDER=ollama` (for example)
3. Refresh browser
4. Works immediately!

---

## 📖 Usage Examples

### Via Web UI

1. Open http://localhost:3000
2. Paste code in the editor
3. Select Language, Persona, Tone
4. Click **"Narrate"**
5. Listen to the AI speak

### Via REST API

```bash
# Narrate JavaScript
curl -X POST http://localhost:3000/api/narrate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "const x = 42;",
    "language": "javascript",
    "persona": "javascript",
    "tone": "playful"
  }'
```

### Via VSCode Extension

1. Install extension from `vscode-extension/` folder
2. Open any code file
3. Press `Ctrl+Shift+N` to narrate
4. Use sidebar to change personas/tones

### Via Node.js

```javascript
const http = require('http');

const data = JSON.stringify({
  code: 'function fib(n) { return n <= 1 ? n : fib(n-1) + fib(n-2); }',
  language: 'javascript',
  persona: 'javascript',
  tone: 'brutal'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/narrate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log(JSON.parse(body)));
});

req.write(data);
req.end();
```

---

## 🧪 Testing

### Test Without API Keys (Mock Mode)

```bash
node test-llm-mock.js
```

Returns fake narrations (no real API calls).

### Test With Real Provider

```bash
node test-llm.js
```

Makes actual API calls to your configured provider.

### Manual Testing

```bash
# Start server
npm start

# In another terminal, test endpoint
curl http://localhost:3000/api/health

# Test narration
curl -X POST http://localhost:3000/api/narrate \
  -H "Content-Type: application/json" \
  -d '{"code":"x=1","language":"python","persona":"python","tone":"casual"}'
```

---

## 🔧 Development

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

Auto-restarts on file changes.

### Build VSCode Extension

```bash
cd vscode-extension
npm install
npm run compile
npm run vscode:prepublish
vsce package
```

### File Structure

- **src/server.js** — Main Express server + WebSocket
- **src/llm-provider.js** — Multi-provider LLM router
- **src/personas.js** — All 8 personas & 7 tones
- **src/narrator.js** — Narration generation logic
- **web/index.html** — Web UI (mobile-first responsive)
- **vscode-extension/** — VSCode integration
- **test-llm-mock.js** — Mock testing (no API calls)
- **test-llm.js** — Real provider testing

---

## 🚨 Troubleshooting

### No Narration Appearing?

1. Check API key is set: `echo $ANTHROPIC_API_KEY`
2. Verify server is running: `curl http://localhost:3000/api/health`
3. Check browser console for errors (F12)
4. Check server logs for errors

### Audio Not Playing?

1. Ensure `ELEVENLABS_API_KEY` is set
2. Check browser audio permissions
3. Try a different persona/tone
4. Check browser speaker volume

### Ollama Not Connecting?

1. Verify Ollama is running: `ollama serve`
2. Check URL in .env: `OLLAMA_API_URL=http://localhost:11434`
3. Test connection: `curl http://localhost:11434/api/tags`

### Provider Timeout?

1. Check internet connection
2. Try fallback provider (automatic)
3. Check API key is valid
4. Review rate limits for that provider

### WebSocket Connection Failed?

1. Ensure server is running: `npm start`
2. Check port: `lsof -i :3000`
3. Try different browser
4. Check firewall settings

---

## 📚 Documentation Files

- **QUICK_REFERENCE.md** — 1-minute setup guide
- **MULTI_LLM_INTEGRATION.md** — Deep dive on providers
- **README_MULTI_LLM.md** — Overview & examples
- **LOCALHOST_STATUS.md** — Server status & diagnostics

---

## 🎯 Features Roadmap

- [x] Multi-LLM provider support
- [x] 8 language personas
- [x] 7 tone styles
- [x] Web UI dashboard
- [x] WebSocket real-time
- [x] REST API
- [x] VSCode extension
- [ ] Custom persona creation
- [ ] Audio playback controls
- [ ] Persistent history & analytics
- [ ] Integration with more editors (Vim, Neovim)
- [ ] Team narration sessions
- [ ] Custom voice selection
- [ ] Code diff narration

---

## 📄 License

MIT

---

## 👤 Credits

**Built by LÉO** — The Universal Paradigm Smith

- Multi-LLM integration architecture
- Mobile-first responsive design
- Language-specific AI personas
- Provider fallback system

---

## 🔗 Resources

- **Claude API**: https://console.anthropic.com
- **Ollama**: https://ollama.ai
- **HuggingFace**: https://huggingface.co/settings/tokens
- **Grok**: https://x.ai/api
- **VSCode Extension API**: https://code.visualstudio.com/api

---

**Status**: ✅ Production Ready | 🎙️ Active Development

Current Version: **1.0.0**  
Last Updated: February 27, 2026

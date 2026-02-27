# Getting Started with Narrator IDE

## Quick Start (2 minutes)

### 1. Configure API Keys

```bash
cp .env.example .env
```

Edit `.env` and add:
- Your **Anthropic API key** (Claude)
- Your **ElevenLabs API key** (for voice synthesis)

Get keys:
- **Claude**: https://console.anthropic.com
- **ElevenLabs**: https://elevenlabs.io

### 2. Start the Server

```bash
./START.sh
```

Or manually:
```bash
npm install
npm start
```

You should see:
```
✨ Narrator IDE Server running on http://localhost:3000
🎙️  WebSocket connections: ws://localhost:3000
```

### 3. Open the Web Dashboard

Open **http://localhost:3000** in your browser.

You'll see:
- Current narrator persona
- Available language personas
- Available tones
- Live narration history

### 4. Install VSCode Extension (Optional)

```bash
cd vscode-extension
npm install
npm run compile
```

Then in VSCode:
- Go to **Extensions** → **Install from VSIX**
- Select the `.vsix` file from the vscode-extension folder
- Restart VSCode

Open any code file and press **Ctrl+Shift+N** to toggle narration.

---

## How It Works

### The Flow

1. **You edit code** in VSCode or send it to the server
2. **Narrator detects** the file type → loads persona
3. **Claude generates** narration in the persona's voice
4. **ElevenLabs synthesizes** the narration as audio
5. **Audio plays** automatically
6. **Narration appears** in the dashboard

### Example

**File:** `app.js`  
**Your code:** `const x = 42;`

**Narrator (JavaScript - Chaos Agent):**  
> "Okay, you're initializing a variable. Classic JavaScript chaos. The number 42—ultimate answer to everything. Let's run with it."

---

## Personas Explained

### 🦀 **Rust** - The Meticulous Engineer
*Voice: Deep, deliberate, protective*

- Obsessed with correctness and memory safety
- Warns about dangers
- Celebrates when things compile
- Best for: Learning Rust, understanding safety

**Example narration:**
> "The borrow checker isn't punishing you—it's protecting you. Let's make sure we handle this error case properly."

### 🐹 **Go** - The Pragmatist
*Voice: Clear, fast, direct*

- Values simplicity and done-ness
- No-nonsense, slightly impatient
- Avoids over-engineering
- Best for: Quick prototypes, distributed systems

**Example narration:**
> "Done is better than perfect. Here's the simple solution. Let's ship it."

### 🐍 **Python** - The Gen-Z Creative
*Voice: Young, expressive, accessible*

- Celebrates readability
- Inclusive and friendly
- Finds the "obvious" way
- Best for: Learning Python, teaching

**Example narration:**
> "There's like, one obvious way to do this, bestie. Python just gets it."

### ⚡ **JavaScript** - The Chaos Agent
*Voice: Fast, energetic, feral*

- Embraces the absurdity
- References frameworks constantly
- Fast-talking energy
- Best for: Understanding JS quirks, humor

**Example narration:**
> "It works. Don't ask me how. There are 47 frameworks for this now."

### 🔨 **C** - The Elder Craftsman
*Voice: Wise, careful, grave*

- Treats memory as sacred
- Expects mastery
- Serious and protective
- Best for: Understanding systems programming

**Example narration:**
> "You're playing with fire here. Every pointer matters. One mistake and everything breaks."

### ☕ **Java** - The Corporate Consultant
*Voice: Professional, formal, structured*

- Talks about design patterns
- Enterprise-focused
- By-the-book approach
- Best for: Understanding OOP, enterprise patterns

**Example narration:**
> "Let's consider the design patterns here. An abstract factory might serve us well."

### 🌀 **Lisp** - The Philosopher
*Voice: Meditative, abstract, contemplative*

- Sees code as poetry
- Asks existential questions
- Explores structure deeply
- Best for: Meta-programming, functional thinking

**Example narration:**
> "Code is data. Data is code. What does this mean? Recursion is the root of all things."

### 📘 **TypeScript** - The Careful Editor
*Voice: Warm, reassuring, methodical*

- Celebrates type safety
- Prevents bugs before runtime
- Patient and detailed
- Best for: Type-safe development

**Example narration:**
> "Let me just check the types here... okay, your structure is solid."

---

## Tones Explained

### 🎓 **Academic**
Formal, educational, technical terminology.

### 😊 **Casual**
Relaxed, friendly, conversational.

### 🤣 **Playful**
Fun, humorous, engaging.

### 📚 **Verbose**
Detailed, comprehensive, thorough.

### ⚡ **Concise**
Brief, to-the-point, minimal.

### 💪 **Encouraging**
Positive, supportive, celebratory.

### 🎯 **Brutally Honest**
Critical, calls out problems, no sugarcoating.

---

## Controlling the Narrator

### Via Web Dashboard

1. **Switch Persona**: Click any language in the "Personas" list
2. **Switch Tone**: Click any tone in the "Tones" list
3. **Clear History**: Click "Clear History" button
4. **Watch Live**: Narrations appear in real-time as you code

### Via VSCode Extension

- **Ctrl+Shift+N** - Toggle narration on/off
- **Command Palette** → "Narrator: Next Persona" - Cycle languages
- **Command Palette** → "Narrator: Next Tone" - Cycle tones

### Via WebSocket

Send JSON messages to `ws://localhost:3000`:

```json
{
  "type": "code-change",
  "code": "const greeting = 'hello world';",
  "language": "javascript",
  "filename": "app.js"
}
```

---

## Troubleshooting

### "No narrations appearing"

**Check:**
1. API keys configured in `.env`?
2. Server running? `http://localhost:3000/api/health`
3. Browser console for WebSocket errors?

**Fix:**
```bash
# Kill old process
killall node
# Restart
npm start
```

### "Audio not playing"

**Check:**
1. ElevenLabs API key valid?
2. Browser audio permissions enabled?
3. Check browser console for errors

### "Connection refused"

**Check:**
1. Is the server running?
2. Is it on the right port (default: 3000)?
3. Check if another process is using port 3000:

```bash
lsof -i :3000
```

### "Extension not working in VSCode"

**Fix:**
1. Restart VSCode completely
2. Check that server is running
3. Change server URL via Command Palette → "Narrator: Set Server URL"

---

## Advanced Usage

### Custom Server URL

If running on a different machine:

**In VSCode:** Command Palette → "Narrator: Set Server URL"  
**In Browser:** Check browser developer console, set in WebSocket handler

### Running on Different Port

```bash
PORT=8080 npm start
```

Then access at `http://localhost:8080`

### Disable TTS (Text-to-Speech)

Remove `ELEVENLABS_API_KEY` from `.env`. Narrations will still appear but won't play audio.

### Disable Auto-Narration

Don't install the VSCode extension. Use the web dashboard instead and manually send code.

---

## Tips & Tricks

### 🎯 Use Brutal Tone for Code Review
Switch to **Brutally Honest** tone to get real feedback on your code.

### 🎓 Use Academic Tone for Learning
Switch to **Academic** tone when learning a new language.

### 🎉 Use Encouraging Tone for Motivation
Switch to **Encouraging** when you need a morale boost.

### 🤖 Different Language = Different Personality
Write Python with the Python persona. Write Rust with the Rust persona. Feel the difference.

### 📱 Monitor Multiple Files
Open the web dashboard in one window, VSCode in another. Watch narrations as you switch files.

---

## API Reference

### WebSocket Messages

**Code Change**
```json
{
  "type": "code-change",
  "code": "const x = 42;",
  "previousCode": "const x = 0;",
  "language": "javascript",
  "filename": "app.js",
  "tone": "casual"
}
```

**Set Persona**
```json
{
  "type": "set-persona",
  "language": "rust"
}
```

**Set Tone**
```json
{
  "type": "set-tone",
  "tone": "verbose"
}
```

### REST Endpoints

```bash
# Get current state
curl http://localhost:3000/api/state

# Get all personas
curl http://localhost:3000/api/personas

# Get all tones
curl http://localhost:3000/api/tones

# Health check
curl http://localhost:3000/api/health

# Narrate text
curl -X POST http://localhost:3000/api/narrate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "language": "python"}'
```

---

## What's Next?

- [ ] Create custom personas
- [ ] Export narration sessions as audio
- [ ] Integrate with Git (narrate commits)
- [ ] Team narration (multiple people, one narrator)
- [ ] Vim/Neovim plugin
- [ ] IDE plugins for JetBrains, Sublime
- [ ] Persistent history and analytics

---

**Ready to code with narration? Start with `./START.sh`**

Need help? Check the README.md or file an issue.

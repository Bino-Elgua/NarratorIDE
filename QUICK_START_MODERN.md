# 🚀 Narrator IDE Modern - Quick Start

## 30-Second Setup

```bash
cd narrator-ide
npm start
```

Then open: **http://localhost:3000/index-modern.html**

(Or use the switch script: `./SWITCH_TO_MODERN.sh` then `npm start`)

---

## What You See

```
┌────────────────────────────────────────────────────────────────┐
│ 🎙️ Narrator IDE │ untitled.js │ ● Ready │ Claude │ ⚡JS │ ⌘ │ 🎙️ │ ⚙️ │
├──────────────┬──────────────────────────────┬──────────────────┤
│              │                              │                  │
│  CONTROLS    │                              │  NARRATION LOG   │
│              │                              │                  │
│  Persona: JS │        CODE EDITOR           │  Live:           │
│  Tone:       │        (Monaco)              │  "Yo, you're..." │
│  playful     │                              │                  │
│              │                              │  History:        │
│  Status:     │      Type here!              │  [Card 1]        │
│  Enabled ✓   │                              │  [Card 2]        │
│              │                              │                  │
│  Metrics:    │                              │  [Scrollable]    │
│  Response:   │                              │                  │
│  45ms        │                              │                  │
│              │                              │                  │
├──────────────┼──────────────────────────────┼──────────────────┤
│ ▲ Splitter (drag to resize)                                    │
├────────────────────────────────────────────────────────────────┤
│ [Problems] [Queue] [Terminal]                                  │
│                                                                │
│ No problems detected                                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 🎙️ Controls (Left)
1. **Persona**: Choose from 8 AI voices (JavaScript, Python, Rust, etc.)
2. **Tone**: Choose style (playful, brutal, casual, etc.)
3. **Narration Status**: Enable/disable with toggle
4. **Metrics**: See response time and last narration

### ⌨️ Editor (Center)
- Type code in the Monaco editor
- File tabs at top (multi-file ready)
- Narration triggers automatically after 500ms of no typing
- Minimap on right edge

### 🎙️ Narration (Right)
**Live** section:
- Shows current narration in real-time

**History** section:
- Cards with persona emoji, timestamp, text
- Copy button (Ctrl+C on card)
- Pin button (save favorites)

### 🔧 Bottom Panel
- **Problems**: Warnings and issues
- **Queue**: Pending narrations
- **Terminal**: Future terminal output
- Resizable (drag top edge)
- Toggle with `Ctrl+J`

---

## Essential Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | **Open Command Palette** (search any command) |
| `Ctrl+Shift+N` | Toggle narration on/off |
| `Ctrl+Alt+P` | Jump to next persona |
| `Ctrl+Alt+T` | Jump to next tone |
| `Ctrl+J` | Toggle bottom panel |
| `Ctrl+B` | Toggle left sidebar (controls) |
| `Escape` | Close command palette |

---

## Try This First

1. **Open Command Palette**: Press `Ctrl+Shift+P`
2. **Type**: "next persona"
3. **Press Enter**: Watch the top bar emoji change
4. **Type some code** in the editor:
   ```javascript
   function fib(n) {
     return n <= 1 ? n : fib(n-1) + fib(n-2);
   }
   ```
5. **Wait 500ms**: A narration card appears in the right panel
6. **Click Copy**: Copy the narration to clipboard
7. **Press Ctrl+Alt+P**: Jump to next persona
8. **Wait again**: New narration in a different voice!

---

## Personas & Their Vibes

| Persona | Emoji | Voice | Best For |
|---------|-------|-------|----------|
| JavaScript | ⚡ | Chaos Agent - sarcastic, fast | Modern web code |
| Python | 🐍 | Gen-Z Creative - casual, fun | AI/ML code |
| Rust | ⚙️ | Meticulous Engineer - careful | Systems code |
| Go | 🚀 | Pragmatist - direct, quick | Backend/CLI |
| TypeScript | 📘 | Careful Editor - precise | Typed code |
| Java | ☕ | Corporate Consultant - formal | Enterprise |
| C | 💎 | Elder Craftsman - wise | Low-level |
| Lisp | 🧠 | Philosopher - contemplative | Functional |

---

## Command Palette Essentials

Press `Ctrl+Shift+P`, then type:

- **"narrate"** → Toggle narration
- **"persona"** → Next persona
- **"tone"** → Next tone
- **"history"** → Clear history
- **"toggle left"** → Show/hide controls
- **"toggle right"** → Show/hide narration
- **"toggle bottom"** → Show/hide panel

---

## Resizing Bottom Panel

1. Hover over the gray line above the panel tabs
2. Cursor changes to ↕️ resize cursor
3. Drag up/down to resize
4. Min height: 80px | Max: 600px

---

## Copy & Pin Narrations

In the **History** section, each card has buttons:

- **📋 Copy**: Copies narration text to clipboard
- **📌 Pin**: Saves as favorite (future: separate pinned section)

---

## Tips & Tricks

- 💡 **Use Command Palette**: It's faster than buttons. Press `Ctrl+Shift+P` frequently.
- 💡 **Keyboard Cycling**: `Ctrl+Alt+P` and `Ctrl+Alt+T` to quickly audition personas/tones
- 💡 **Auto-Narration**: You don't need to click anything. Just type and wait 500ms.
- 💡 **Collapse Sidebars**: Use `Ctrl+B` and `Ctrl+Shift+G` for distraction-free editing
- 💡 **Focus Editor**: Press `Ctrl+E` to focus the editor (useful after palette)

---

## Troubleshooting

**Q: Nothing happens when I type code?**  
- Check the connection status (top bar) says "Ready" ✓
- Wait 500ms after you stop typing
- Check the provider badge shows a provider (Claude, Ollama, etc.)

**Q: Command Palette not opening?**  
- Make sure you're pressing `Ctrl+Shift+P` (not `Cmd+Shift+P` on Mac)
- Try Shift+Ctrl instead
- Reload page

**Q: Narration in wrong color/persona?**  
- Press `Ctrl+Alt+P` to cycle to correct persona
- Or use Command Palette: `Ctrl+Shift+P` → "next persona"

**Q: Bottom panel won't resize?**  
- Make sure you're hovering over the gray splitter line (top of panel)
- Cursor should change to ↕️ before dragging

**Q: History cards disappeared?**  
- Use Command Palette (`Ctrl+Shift+P`) and search "clear"
- Or check the bottom panel **Queue** tab

---

## Next: Configure LLM Provider

By default, Narrator IDE uses **Claude** (Anthropic).

To use a different provider, edit `.env`:

```env
# Option 1: Claude (default)
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...

# Option 2: Ollama (free, local)
LLM_PROVIDER=ollama
# Then run: ollama serve (in another terminal)

# Option 3: HuggingFace (cheap)
LLM_PROVIDER=hf
HF_TOKEN=hf_...

# Option 4: Grok (new)
LLM_PROVIDER=grok
XAI_API_KEY=xai_...
```

Then restart: `npm start`

---

## Keyboard Reference Card

Keep this handy:

```
┌─ NARRATOR IDE KEYBOARD SHORTCUTS ─────────────┐
│ Ctrl+Shift+P  Command Palette                 │
│ Ctrl+Shift+N  Toggle Narration                │
│ Ctrl+Alt+P    Next Persona                    │
│ Ctrl+Alt+T    Next Tone                       │
│ Ctrl+J        Toggle Bottom Panel             │
│ Ctrl+B        Toggle Left Sidebar             │
│ Ctrl+Shift+G  Toggle Right Sidebar            │
│ Ctrl+E        Focus Editor                    │
│ Escape        Close Palette                   │
└───────────────────────────────────────────────┘
```

---

## Support

- 📖 Full docs: See `MODERN_IDE_UPGRADE.md`
- 🐛 Issues? Check browser console (F12)
- 💬 Questions? Check `README.md`

---

**Happy narrating!** 🎙️✨

*Open http://localhost:3000 in your browser now →*

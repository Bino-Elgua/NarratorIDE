# Narrator IDE - UI Layout Reference

## Desktop Layout (> 1024px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🎙️ Narrator IDE    Connected • Claude ⚙️ ? 🎙️                              │  Top Bar (60px)
│────────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│  LEFT SIDEBAR (280px)   CENTER EDITOR (1fr)      RIGHT SIDEBAR (320px)         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐          │
│  │ Controls      ◀ │  │  const greeting  │  │ Narration          ▶ │          │
│  ├──────────────────┤  │  = "Hello";      │  ├──────────────────────┤          │
│  │ Language Persona │  │                  │  │ Live Output:         │          │
│  │ [Dropdown ▼]     │  │  console.log(    │  │                      │          │
│  │ You're creating  │  │    greeting      │  │ "You're setting up a│          │
│  │ The Chaos Agent  │  │  );              │  │  greeting variable   │          │
│  │                  │  │                  │  │  in JavaScript."     │          │
│  │ Tone Style       │  │  // Welcome...   │  │                      │          │
│  │ [Casual ▼]       │  │                  │  ├──────────────────────┤          │
│  │ Friendly vibe    │  │                  │  │ Audio:               │          │
│  │                  │  │                  │  │ [▶  🔊  ──── 0:05]   │          │
│  │ Language:        │  │                  │  │                      │          │
│  │ [JavaScript]     │  │                  │  ├──────────────────────┤          │
│  │ [Override]       │  │                  │  │ History              │          │
│  │                  │  │                  │  │ [Clear]              │          │
│  │ Narration Status │  │                  │  ├──────────────────────┤          │
│  │ [✓ Enabled]      │  │                  │  │ "You're creating..." │          │
│  │                  │  │                  │  │ JS · Casual · 15:30  │          │
│  │ Metrics:         │  │                  │  │                      │          │
│  │ Last: 5s ago     │  │                  │  │ "const greeting..." │          │
│  │ Response: 245ms  │  │                  │  │ JS · Playful · 15:28 │          │
│  │ LLM: Claude      │  │                  │  │                      │          │
│  │                  │  │                  │  │ (max 50 items)      │          │
│  └──────────────────┘  │ ↑ Ready          │  └──────────────────────┘          │
│                        └──────────────────┘                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Layout (< 768px)

```
┌────────────────────────────────┐
│ 🎙️ Narrator IDE  Connected ⚙️ ?│  Top Bar (50px)
├────────────────────────────────┤
│                                │
│                                │
│   const greeting = "Hello";    │
│                                │
│   console.log(greeting);       │  Editor (Full Width)
│                                │
│   // Welcome to Narrator IDE   │
│                                │
│                                │
├────────────────────────────────┤
│ Controls│Narr.│History         │  Mobile Tab Bar (50px)
└────────────────────────────────┘
     (tap to show sheet)

─────────────────────────────────────────
│ When "Controls" tab active:            │ Bottom Sheet
│                                        │ (modal overlay)
│ Language Persona                       │
│ [JavaScript ▼]                         │
│                                        │
│ Tone Style                             │
│ [Casual ▼]                             │
│                                        │
│ Language: [JavaScript]                 │
│                                        │
│ [✓ Narration Enabled]                  │
│                                        │
│ Metrics:                               │
│ Last: 5s ago                           │
│ Response: 245ms                        │
│ LLM: Claude                            │
─────────────────────────────────────────
```

---

## Control Groups - Left Sidebar

### Persona Selector
```
┌─────────────────────────────────┐
│ LANGUAGE PERSONA                │
├─────────────────────────────────┤
│ [JavaScript ▼]                  │
│                                 │
│ The Chaos Agent                 │
│ Fast, opinionated, feral.       │
│ Loves bold decisions and        │
│ unfiltered commentary.          │
└─────────────────────────────────┘
```

### Tone Selector
```
┌─────────────────────────────────┐
│ TONE STYLE                      │
├─────────────────────────────────┤
│ [Casual ▼]                      │
│                                 │
│ Conversational, friendly,       │
│ and approachable.               │
└─────────────────────────────────┘
```

### Metrics Box
```
┌──────────────────────────────────────┐
│ METRICS                              │
├──────────────────────────────────────┤
│ Last Narrated:      5s ago           │
│ Response Time:      245ms            │
│ LLM Provider:       Claude           │
└──────────────────────────────────────┘
  (Blue-accented, semi-transparent bg)
```

---

## Narration Output - Right Sidebar

### Live Narration
```
┌──────────────────────────────────────┐
│ LIVE OUTPUT                          │
├──────────────────────────────────────┤
│                                      │
│ "You're setting up a greeting       │
│  variable in JavaScript with a      │
│  classic 'Hello' message. Nice      │
│  start to any program!"             │
│                                      │
│ (Fades in with persona color)       │
└──────────────────────────────────────┘
```

### Narration History Item
```
┌──────────────────────────────────────┐
│ "You're creating a function..."      │  ← Text
│                                      │
│ [JS]  [Casual]  15:30                │  ← Meta
│ (badges + timestamp)                 │
│ (Click to replay)                    │
└──────────────────────────────────────┘
  (Left border: blue, hover: highlights)
```

---

## Top Bar Components

### Connection Status
```
┌───────────────────────┐
│ ● Connected • Claude  │  (Green dot + text + provider badge)
└───────────────────────┘
```

### Icon Buttons
```
[🎙️] [?] [⚙️]  (Right-aligned, hover → blue)
```

---

## Modal Windows

### Settings Modal
```
┌────────────────────────────────────────────┐
│ Settings                            [×]    │
├────────────────────────────────────────────┤
│                                            │
│ LLM Provider                               │
│ [Claude ▼]                                 │
│   Options: Ollama, HuggingFace, Grok     │
│                                            │
│ Text-to-Speech                             │
│ [☐] Enable audio narration                 │
│                                            │
│ API Key                                    │
│ [••••••••••••••••]                         │
│                                            │
│ ⓘ API keys stored locally, never shared   │
│                                            │
│                              [Close]      │
└────────────────────────────────────────────┘
```

### Help Modal
```
┌────────────────────────────────────────────┐
│ Keyboard Shortcuts                   [×]   │
├────────────────────────────────────────────┤
│                                            │
│ Ctrl+Shift+N    Toggle narration           │
│ Ctrl+Alt+P      Next persona               │
│ Ctrl+Alt+T      Next tone                  │
│ Escape          Close modals               │
│                                            │
│                                            │
└────────────────────────────────────────────┘
```

---

## Responsive Breakpoints

### Large Desktop (> 1400px)
```
Left Sidebar: 300px
Editor: flex
Right Sidebar: 340px
(Comfortable spacing)
```

### Desktop (1024px - 1400px)
```
Left Sidebar: 280px
Editor: flex
Right Sidebar: 320px
(Optimal for most monitors)
```

### Tablet (769px - 1023px)
```
Left Sidebar: 240px
Editor: flex
Right Sidebar: 260px
(Compressed but functional)
```

### Mobile (481px - 768px)
```
Sidebars: hidden
Editor: 100%
Tab Bar: 50px
Bottom Sheet: max 50vh
(Full-width editing, sheet overlays)
```

### Small Mobile (< 480px)
```
Same as mobile but:
- Compact top bar (smaller font)
- Hidden provider badge
- Smaller icon buttons
- Reduced padding
```

---

## Color Usage Guide

### Text Elements
- **Headings**: `#c9d1d9` (primary)
- **Body**: `#c9d1d9` (primary)
- **Labels**: `#8b949e` (secondary)
- **Hints**: `#6e7681` (tertiary)

### Interactive Elements
- **Buttons (default)**: `#8b949e` text, hover → `#58a6ff`
- **Links**: `#58a6ff`, hover → `#d29eff`
- **Active/Selected**: `#58a6ff` background + border

### Persona-Specific
- **JavaScript**: `#f7df1e` (yellow)
- **Rust**: `#ce9178` (orange)
- **Python**: `#3776ab` (blue)
- **Go**: `#00add8` (cyan)
- **TypeScript**: `#3178c6` (blue)
- **Java**: `#007396` (blue)
- **C**: `#555555` (gray)
- **Lisp**: `#3f26bf` (purple)

### Badges
- **Persona**: Blue background (10% opacity) + border
- **Tone**: Red background (10% opacity) + border
- **Success**: Green background
- **Error**: Red background
- **Warning**: Orange background

---

## Sidebar Collapse Animation

```
Collapsed state (0 width):
←[Icon only visible]

Expanded state (280px):
←[Full sidebar with content]

Transition: 250ms ease
```

---

## Mobile Tab Switching

### Tab Bar States
```
Default:
[Controls] [Narration] [History]
   ↑
   active (blue underline)

After click:
[Controls] [Narration] [History]
              ↑
              active → slide up bottom sheet
```

### Bottom Sheet Animation
```
Closed:    ┌────────────────┐
           │ (Hidden below) │
           └────────────────┘

Opening:   ┌────────────────┐
           │ (Sliding up)   │
           └────────────────┘

Open:      ┌────────────────┐
           │ Controls       │
           │ Persona: JS ▼  │
           │ Tone: Casual ▼ │
           │ ...            │
           └────────────────┘
             (Max 50vh height)
```

---

## Animation Examples

### Narration Text Fade-In
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Applied to each narration.text element */
```

### Status Dot Pulse
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
/* Red dot pulsing when disconnected */
/* Green dot solid when connected */
```

### Modal Fade-In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Applied to .modal when .active */
```

---

## Accessibility Highlights

### Focus States
```
┌─────────────────┐
│ [Blue border]   │  Focus-visible (keyboard nav)
│ [Outline: 2px]  │
└─────────────────┘
```

### High Contrast Mode
```
- Borders thicker (2px instead of 1px)
- Text bolder where applicable
- Higher color contrast ratios
```

### Reduced Motion
```
- Animations disabled
- Transitions instant
- Still fully functional
```

---

## CSS Grid Template Columns

### Desktop
```css
grid-template-columns: 280px 1fr 320px;
gap: 0;
```

### Tablet
```css
grid-template-columns: 240px 1fr 260px;
gap: 0;
```

### Mobile
```css
display: block;  /* Grid disabled */
(Stacked vertically)
```

---

## File Organization Structure
```
narrator-ide/
├── web/
│   ├── index.html          (Main HTML - ~380 lines)
│   ├── css/
│   │   └── style.css       (All styling - ~950 lines)
│   └── js/
│       ├── app.js          (Core logic - ~550 lines)
│       ├── websocket.js    (Communication - ~200 lines)
│       └── ui.js           (Utilities - ~350 lines)
├── src/
│   ├── server.js
│   ├── personas.js
│   └── ... (server code)
└── UI_UPGRADE_SUMMARY.md   (This doc + reference)
```

---

## Quick CSS Class Reference for Theming

To change accent color globally, modify `:root`:
```css
:root {
  --color-blue: #58a6ff;    /* Change this */
  --text-primary: #c9d1d9;  /* Or this */
  --bg-primary: #0d1117;    /* Or this */
}
```

To add a new persona color:
```css
:root {
  --persona-custom: #abc123;
}

.narration-text.persona-custom {
  color: var(--persona-custom);
  font-weight: 500;
}
```

---

**Last Updated**: February 27, 2026  
**Design System**: GitHub Dark Mode + AI-native UI patterns

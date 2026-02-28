# Narrator IDE UI - Quick Start Guide

## What Changed

Your Narrator IDE now has a **professional three-column dashboard** (desktop) that collapses to mobile-friendly single-column on smaller screens.

**Before**: Basic single-file HTML  
**After**: Modular, responsive, modern AI-coding-tool aesthetic

---

## Files Overview

### HTML Structure
**File**: `web/index.html` (~380 lines)
- Top bar: Logo, status, controls
- Three-column grid: Left sidebar → Editor → Right sidebar
- Mobile tabs: Bottom tab bar + sheet for mobile
- Modals: Settings, Help

### Styling
**File**: `web/css/style.css` (~950 lines)
- Dark theme (GitHub Dark Mode)
- CSS Grid responsive layout
- Persona colors
- Animations & transitions
- Mobile breakpoints

### JavaScript - Core Logic
**File**: `web/js/app.js` (~550 lines)
- Monaco Editor initialization
- State management
- Narration triggering
- History tracking
- Keyboard shortcuts

### JavaScript - Communication
**File**: `web/js/websocket.js` (~200 lines)
- WebSocket connection/reconnection
- Message handling
- State sync with server

### JavaScript - Utilities
**File**: `web/js/ui.js` (~350 lines)
- Toast notifications
- Clipboard helpers
- Format utilities
- Responsive observer
- Browser detection

---

## Layout at a Glance

### Desktop (> 1024px)
```
┌─ Top Bar ──────────────────────────────────┐
├─ Left (280px) ─ Center (flex) ─ Right (320px) ─┤
│   Controls       Editor         Narration      │
│   Personas       Monaco         History        │
│   Tones                         Live Output    │
│   Metrics                                      │
└────────────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌─ Top Bar ──────────────────────┐
├─ Code Editor (100%) ──────────┤
├─ Controls │ Narration │ History┤ ← Tabs
└─ Bottom Sheet (on tab click) ──┘
```

---

## Key Components

### Left Sidebar - Controls
- **Persona Selector**: Choose from 8 language personas
- **Tone Selector**: Pick from 7 tone styles
- **Language Auto-Detect**: Detects automatically, can override
- **Narration Toggle**: Enable/disable with visual feedback
- **Metrics**: Shows last narration time, response latency, LLM provider

### Center - Code Editor
- **Monaco Editor**: Full-featured code editing
- **Auto-detect Language**: From code content
- **Debounced Narration**: ~800ms after you stop typing
- **Line Numbers & Minimap**: Standard editor features
- **Dark Theme**: Matches overall UI

### Right Sidebar - Narration Output
- **Live Narration**: Current text (persona-colored)
- **Audio Player**: Optional TTS playback
- **History**: Last 50 narrations (click to replay)
- **Metadata**: Persona badge, tone badge, timestamp

### Top Bar
- **Logo + Title**: Gradient text
- **Connection Status**: Dot indicator + provider badge
- **Quick Buttons**: Narration toggle, Help, Settings

---

## How to Use

### Basic Flow
1. **Open** http://localhost:3000
2. **Paste or type** code in the center editor
3. **See narration** appear in right panel (live output)
4. **Change persona/tone** in left sidebar to adjust narration style
5. **Toggle narration** on/off if needed
6. **View history** in right sidebar, click to replay

### Keyboard Shortcuts
- **Ctrl+Shift+N** - Toggle narration on/off
- **Ctrl+Alt+P** - Cycle to next persona
- **Ctrl+Alt+T** - Cycle to next tone
- **Escape** - Close modals

### Mobile
1. Tap **Controls/Narration/History** tabs at bottom
2. Bottom sheet slides up with content
3. Tap elsewhere to collapse sheet
4. Editor always full-width for easy viewing

### Settings
1. Click **⚙️** icon (top right)
2. Choose LLM provider (Claude, Ollama, HuggingFace, Grok)
3. Enable/disable TTS if applicable
4. Enter API key if needed
5. Click Close

### Help
1. Click **?** icon (top right)
2. See keyboard shortcuts
3. Close modal

---

## Customization

### Change Theme Colors
Edit `web/css/style.css`, update `:root`:
```css
:root {
  --color-blue: #58a6ff;      /* Primary accent */
  --color-green: #3fb950;     /* Success color */
  --text-primary: #c9d1d9;    /* Main text */
  --bg-primary: #0d1117;      /* Background */
  /* ... more variables ... */
}
```

### Add New Persona Color
```css
:root {
  --persona-mycolor: #abc123;
}

.narration-text.persona-mycolor {
  color: var(--persona-mycolor);
}
```

### Adjust Editor Font
In `web/js/app.js`, `initMonacoEditor()`:
```javascript
fontSize: 14,                    // Change here
fontFamily: 'Monaco, ...',      // Or here
tabSize: 2,                      // Indent size
```

### Change Debounce Delay
In `web/js/app.js`, `debounceNarration()`:
```javascript
narrationTimeout = setTimeout(() => {
  triggerNarration();
}, 800);  // Change 800 to desired milliseconds
```

### Modify History Limit
In `web/js/app.js`, `addToHistory()`:
```javascript
if (appState.narrationHistory.length > 50) {  // Change 50
  appState.narrationHistory.pop();
}
```

---

## Integration with Server

### Server Must Provide
1. **WebSocket endpoint**: `ws://localhost:3000`
2. **Static files**: HTML, CSS, JS served properly
3. **Message handlers**:
   - `narrate` → Process code + return narration
   - `get-personas` → Return persona list
   - `get-tones` → Return tone list
   - `set-persona` → Update selected persona
   - `set-tone` → Update selected tone

### Expected Narration Response
```json
{
  "type": "narration",
  "data": {
    "text": "You're creating a variable here...",
    "persona": {"id": "javascript", "name": "The Chaos Agent"},
    "tone": "casual",
    "audio": "base64-encoded-mp3-here",
    "timestamp": "2026-02-27T15:30:00Z"
  }
}
```

---

## Responsive Behavior

### Desktop
- All 3 sidebars visible
- Full controls access
- Professional layout
- No tab bar

### Tablet (769px - 1023px)
- Narrower sidebars
- Still 3-column grid
- All features available
- No tab bar

### Mobile
- Sidebars hidden
- Editor full-width
- Bottom tab bar (50px)
- Click tabs → bottom sheet slides up
- Touch-friendly spacing

### Testing Mobile
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile device
4. Reload page
5. See responsive layout

---

## Browser Compatibility

### Required
- ✅ Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- ✅ WebSocket support
- ✅ ES6+ (const, arrow functions, destructuring)
- ✅ CSS Grid support

### Optional
- ⚠️ Web Audio API (for TTS audio)
- ⚠️ Clipboard API (for copy functionality)

### Check Compatibility
Open browser console:
```javascript
// Should all be true:
typeof WebSocket !== 'undefined'              // WebSocket
CSS.supports('display', 'grid')              // CSS Grid
typeof fetch !== 'undefined'                 // Fetch API
navigator.clipboard !== undefined           // Clipboard
```

---

## Troubleshooting

### Editor doesn't appear
- Wait for Monaco CDN to load (1-2 seconds)
- Check browser console for errors (F12)
- Verify `require.config` paths correct
- Check internet connection (CDN access)

### No narration showing
- Ensure WebSocket connected (check top bar status dot)
- Verify code is > 10 characters
- Check narration toggle is enabled
- Try refreshing page
- See browser DevTools → Network → WS messages

### Controls not responsive
- Clear browser cache (Ctrl+Shift+Delete)
- Check CSS file loaded (`web/css/style.css`)
- Verify JS files loaded (DevTools → Sources)
- Try different browser

### Mobile layout broken
- Force reload (Ctrl+Shift+R)
- Check viewport meta tag in HTML
- Test in device emulator (DevTools)
- Check window width < 768px

### WebSocket connection failing
- Ensure server running on port 3000
- Check firewall/proxy not blocking WS
- Verify protocol correct (`ws://`, not `wss://`)
- Try `http://localhost:3000/api/health` in browser

---

## Performance Tips

### Optimization Already Built-In
- ✅ Debounced narration (800ms) - Reduces API calls
- ✅ Limited history (50 items) - Memory efficient
- ✅ CSS Grid - GPU accelerated
- ✅ Lazy-loaded modals - Rendered only when opened
- ✅ Efficient animations - Transform/opacity only

### Further Optimization
- Enable gzip compression on server
- Minify CSS/JS before production
- Use CDN for Monaco Editor
- Implement caching headers
- Consider code splitting for large JS files

---

## Keyboard Shortcuts (Detailed)

### Narration Control
- `Ctrl+Shift+N` - Toggle narration enabled/disabled
- `Ctrl+Alt+P` - Cycle to next persona (wraps around)
- `Ctrl+Alt+T` - Cycle to next tone (wraps around)

### Editor (Monaco-native)
- `Ctrl+/` - Toggle line comment
- `Shift+Alt+A` - Toggle block comment
- `Ctrl+F` - Find
- `Ctrl+H` - Find and replace
- `Ctrl+Shift+F` - Find in files

### Modals
- `Escape` - Close settings or help modal

### Future (Not yet implemented)
- `Ctrl+S` - Save code
- `Ctrl+Shift+H` - Clear history
- `Ctrl+Shift+C` - Copy narration

---

## CSS Classes for Custom Styling

### Main Layout
- `.app-container` - Root
- `.top-bar` - Header
- `.main-grid` - Three-column
- `.sidebar` - Left/right sidebars
- `.editor-container` - Editor wrapper

### Narration
- `.narration-text` - Narration paragraph
- `.narration-item` - History entry
- `.persona-badge` - Badge styling
- `.tone-badge` - Tone label

### Controls
- `.control-group` - Form field wrapper
- `.control-label` - Label text
- `.control-select` - Dropdown
- `.toggle-switch` - Toggle button

### Modals
- `.modal` - Dialog container
- `.modal-backdrop` - Background overlay
- `.modal-content` - Dialog box

---

## File Sizes

| File | Size (uncompressed) | Size (gzipped) |
|------|-------------------|----------------|
| index.html | 12 KB | ~3 KB |
| style.css | 45 KB | ~8 KB |
| app.js | 22 KB | ~6 KB |
| websocket.js | 8 KB | ~2 KB |
| ui.js | 14 KB | ~3 KB |
| **Total** | **~101 KB** | **~22 KB** |

*Note: Monaco Editor CDN adds ~500KB (already cached by browser)*

---

## What's Next?

### Planned Features (Phase 2)
- [ ] Multi-file editor
- [ ] Resizable panels
- [ ] Local storage persistence
- [ ] Dark/light theme toggle
- [ ] Copy narration to clipboard

### Future Enhancements (Phase 3+)
- [ ] Inline code highlights
- [ ] Collaborative sessions
- [ ] Custom personas
- [ ] Narration filters
- [ ] Playback speed control

---

## Support Resources

- **README.md** - Full documentation
- **UI_UPGRADE_SUMMARY.md** - Detailed architecture
- **UI_LAYOUT_REFERENCE.md** - Visual reference & specs
- **MULTI_LLM_INTEGRATION.md** - LLM provider details

---

## Quick Commands

### Run development server
```bash
cd narrator-ide
npm start
```

### Test with mock LLM (no API keys needed)
```bash
node test-llm-mock.js
```

### Test with real LLM
```bash
node test-llm.js
```

### Check server running
```bash
curl http://localhost:3000/api/health
```

---

**Version**: 2.0.0 (Three-Column UI)  
**Last Updated**: February 27, 2026  
**Status**: ✅ Production Ready

Enjoy your new Narrator IDE dashboard! 🎙️

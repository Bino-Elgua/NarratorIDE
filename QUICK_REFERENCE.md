# Quick Reference: Multi-LLM Narrator IDE

## 1-Minute Setup

```bash
# 1. Copy example config
cp .env.example .env

# 2. Edit config (add your API keys)
amp .env

# 3. Start server
npm start
```

## Change Provider (No Code Needed)

Edit `.env` and change:
```env
LLM_PROVIDER=claude
```

Options:
- `claude` (default, recommended)
- `ollama` (free, local)
- `hf` (open-source, cheap)
- `grok` (latest, experimental)

## Get API Keys

| Provider | Link | Free? |
|----------|------|-------|
| Claude | https://console.anthropic.com | No ($) |
| Ollama | https://ollama.ai | Yes ✅ |
| HuggingFace | https://huggingface.co/settings/tokens | Mostly |
| Grok | https://x.ai/api | TBD |

## Verify It Works

```bash
# Test routing (no keys needed)
node test-llm-mock.js

# Test with real provider (needs keys)
node test-llm.js

# Start server
npm start

# Open in browser
# http://localhost:3000
```

## Common Issues

| Problem | Solution |
|---------|----------|
| "No API key" | Add key to `.env`, restart |
| "Ollama connection refused" | Run `ollama serve &` |
| "Wrong provider" | Check `LLM_PROVIDER` in `.env` |
| "Server won't start" | Run `npm install` |

## Provider Speed

**Fastest → Slowest:**
1. Ollama (instant, local)
2. Claude (1-3s)
3. Grok (1-3s)
4. HuggingFace (2-5s)

## Provider Quality

**Best → Good:**
1. Claude ⭐⭐⭐⭐⭐
2. Grok ⭐⭐⭐⭐⭐
3. Ollama ⭐⭐⭐⭐
4. HuggingFace ⭐⭐⭐⭐

## Provider Cost (approx per 1M tokens)

- Claude: $3 input / $15 output
- HuggingFace: ~$2
- Grok: TBD
- Ollama: Free (your CPU)

## Files You Touched

```
.env                      ← Add your API keys here
src/llm-provider.js       ← New multi-provider router
src/narrator.js           ← Updated to use router
package.json              ← New deps added
```

## Files for Reference

```
MULTI_LLM_INTEGRATION.md  ← Full docs (read if confused)
INTEGRATION_COMPLETE.md   ← Summary + quick start
VERIFICATION_CHECKLIST.md ← What was integrated
test-llm-mock.js          ← Test without API keys
test-llm.js               ← Test with API keys
```

## Architecture (Simple Version)

```
Your Code
    ↓
Narrator (detects changes)
    ↓
LLM Router (picks Claude/Ollama/HF/Grok)
    ↓
↓ Narration Text ← With auto-fallback
    ↓
Voice (ElevenLabs)
    ↓
🔊 Audio
```

## Recommended Setup by Use Case

### Just Learning?
```env
LLM_PROVIDER=ollama  # Free, instant
```
Need to install Ollama first (https://ollama.ai)

### Production/Professional?
```env
LLM_PROVIDER=claude  # Best quality
```
Need Claude API key ($)

### Cost-Conscious?
```env
LLM_PROVIDER=hf      # Cheap + good
```
Need HuggingFace token (free to create)

### Bleeding Edge?
```env
LLM_PROVIDER=grok    # Latest tech
```
Need Grok xAI key (new service)

## Fallback Magic

If you set `LLM_PROVIDER=ollama` but Ollama is offline:
- Automatically tries Claude
- If Claude also fails: shows error message
- User never blocked, always gets response

No configuration needed—it just works!

## Monitor in Action

When you start the server:
```bash
npm start
```

You'll see:
```
✨ Narrator IDE Server running on http://localhost:3000
```

When you narrate code, check logs for:
```
[LLM] Using provider: claude
```

## Shortcuts

```bash
# Start normally
npm start

# Start with auto-reload (dev)
npm run dev

# Test without keys
node test-llm-mock.js

# Test with keys
node test-llm.js

# Update dependencies
npm install
```

## Pro Tips

1. **Ollama for testing** - Instant, free, no API keys
2. **Claude for production** - Most reliable
3. **Switch providers anytime** - Just edit `.env`
4. **Check logs** - Look for `[LLM]` messages
5. **Fallback is your friend** - Always has a backup

## FAQ

**Q: Do I need all 4 providers?**  
A: No, just pick one. Claude is default.

**Q: Can I switch providers mid-session?**  
A: Edit `.env` and restart server.

**Q: What if a provider is down?**  
A: Automatically falls back to Claude (if set).

**Q: Is Ollama really free?**  
A: Yes! Just uses your computer's CPU.

**Q: Which provider is fastest?**  
A: Ollama (instant, local).

**Q: Which provider is best quality?**  
A: Claude and Grok (tied).

**Q: Can I use multiple providers?**  
A: Yes, but only one active at a time. Switch in `.env`.

**Q: Does it work offline?**  
A: Only Ollama works fully offline.

---

**Next Steps:**
1. Copy `.env.example` → `.env`
2. Add your API keys
3. Pick a provider
4. Run `npm start`
5. Enjoy narrated coding! 🎙️

---

**Read Full Docs:** `MULTI_LLM_INTEGRATION.md`

#!/bin/bash

# Multi-LLM Weaver for Narrator IDE
# Integrates Claude, Ollama, HuggingFace, and Grok with seamless fallback

set -e

ROOT="/data/data/com.termux/files/home/narrator-ide"
cd "$ROOT" || { echo "❌ Narrator IDE not found at $ROOT"; exit 1; }

echo "🗿 Weaving multi-LLM paths into Narrator IDE..."

# Step 1: Install Dependencies
echo ""
echo "📦 Step 1: Installing dependencies..."
npm install ollama @huggingface/inference axios --save

# Step 2: Patch .env
echo ""
echo "⚙️ Step 2: Extending .env with LLM selector..."
if grep -q "LLM_PROVIDER" .env 2>/dev/null; then
  echo "✓ LLM_PROVIDER already configured"
else
  cat >> .env << 'EOF'

# Multi-LLM Selector (options: claude, ollama, hf, grok)
LLM_PROVIDER=claude

# API Keys
CLAUDE_API_KEY=your_claude_key_here
HF_TOKEN=hf_your_token_here
XAI_API_KEY=xai_your_key_here

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=codellama:7b
EOF
  echo "✓ .env extended with multi-LLM config"
fi

# Step 3: Create LLM provider module
echo ""
echo "🔧 Step 3: Creating multi-provider LLM module..."
cat > src/llm-provider.js << 'EOF'
/**
 * Multi-LLM Provider Router
 * Abstracts Claude, Ollama, HuggingFace, and Grok behind a unified interface
 */

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
require('dotenv').config();

/**
 * Generate narration using selected LLM provider
 * Falls back gracefully if provider unavailable
 */
async function generateNarration(code, persona, tone) {
  const provider = process.env.LLM_PROVIDER || 'claude';
  const prompt = `You are the ${persona} persona in ${tone} tone. Narrate this code's intent and flow in 1-3 sentences: ${code}`;

  console.log(`[LLM] Using provider: ${provider}`);

  try {
    switch (provider) {
      case 'claude':
        return await generateClaude(prompt);
      case 'ollama':
        return await generateOllama(prompt);
      case 'hf':
        return await generateHuggingFace(prompt);
      case 'grok':
        return await generateGrok(prompt);
      default:
        console.warn(`Unknown provider: ${provider}. Falling back to Claude.`);
        return await generateClaude(prompt);
    }
  } catch (error) {
    console.error(`[LLM] ${provider} failed: ${error.message}. Attempting fallback...`);
    
    // Fallback chain
    if (provider !== 'claude') {
      try {
        console.log('[LLM] Falling back to Claude...');
        return await generateClaude(prompt);
      } catch (fallbackError) {
        console.error('[LLM] All providers failed. Returning placeholder.');
        return `Narration paused: ${error.message}. Try another provider or check API keys.`;
      }
    }
    throw error;
  }
}

/**
 * Claude via Anthropic API
 */
async function generateClaude(prompt) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}

/**
 * Ollama (local, self-hosted)
 * Ensure: ollama serve running on OLLAMA_URL
 */
async function generateOllama(prompt) {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'codellama:7b';

  const response = await axios.post(`${url}/api/generate`, {
    model,
    prompt,
    stream: false
  });

  return response.data.response;
}

/**
 * HuggingFace Inference API
 * Requires: HF_TOKEN in .env
 */
async function generateHuggingFace(prompt) {
  const { HfInference } = require('@huggingface/inference');
  const hf = new HfInference(process.env.HF_TOKEN);

  const response = await hf.textGeneration({
    model: 'deepseek-ai/deepseek-coder-6.7b-instruct',
    inputs: prompt,
    parameters: {
      max_new_tokens: 200,
      temperature: 0.7
    }
  });

  // HF returns { generated_text: "prompt...response" }
  return response.generated_text.replace(prompt, '').trim();
}

/**
 * Grok via xAI API
 * Requires: XAI_API_KEY in .env
 * See: https://x.ai/api
 */
async function generateGrok(prompt) {
  const response = await axios.post('https://api.x.ai/v1/chat/completions', {
    model: 'grok-beta',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300
  }, {
    headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` }
  });

  return response.data.choices[0].message.content;
}

module.exports = { generateNarration };
EOF

echo "✓ Multi-provider LLM module created"

# Step 4: Update narrator.js to use new provider
echo ""
echo "🎯 Step 4: Updating narrator.js to use multi-LLM provider..."
cat > src/narrator-updated.patch << 'EOF'
// Replace the Anthropic import line with:
const { generateNarration: generateNarrationLLM } = require('./llm-provider');

// In the narrate() method, replace this line:
//   const response = await this.client.messages.create({...
// With:
//   const narration = await generateNarrationLLM(codeChange.after, this.currentLanguage, this.currentTone);

EOF

# Manual update needed - for now, log instructions
cat > UPDATE_NARRATOR_INSTRUCTIONS.md << 'EOF'
# Update narrator.js for Multi-LLM

In `src/narrator.js`, make these changes:

1. **At the top**, add:
```javascript
const { generateNarration: generateNarrationLLM } = require('./llm-provider');
```

2. **In the `narrate()` method** (around line 116), replace:
```javascript
const response = await this.client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 150,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: userMessage
    }
  ]
});

const narration = response.content[0].text;
```

With:
```javascript
// Multi-LLM: generates narration via configured provider
const narration = await generateNarrationLLM(
  codeChange.after,
  this.currentLanguage,
  this.currentTone
);
```

3. Remove the old Anthropic client initialization (line 14):
```javascript
this.client = new Anthropic({ apiKey: this.apiKey });
```

Done! Now your narrator uses the multi-LLM router.
EOF

echo "✓ Update instructions created (see UPDATE_NARRATOR_INSTRUCTIONS.md)"

# Step 5: Create test script
echo ""
echo "🧪 Step 5: Creating test script..."
cat > test-llm.js << 'EOF'
#!/usr/bin/env node

const { generateNarration } = require('./src/llm-provider');
require('dotenv').config();

const testCode = `
const greeting = (name) => {
  return \`Hello, \${name}!\`;
};
`;

async function runTest() {
  console.log('🧪 Testing Multi-LLM Provider...\n');
  console.log(`Provider: ${process.env.LLM_PROVIDER || 'claude'}`);
  console.log(`Code:\n${testCode}`);
  console.log('---');

  try {
    const narration = await generateNarration(testCode, 'javascript', 'casual');
    console.log(`✓ Narration:\n${narration}\n`);
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  }
}

runTest();
EOF

chmod +x test-llm.js
echo "✓ Test script created: node test-llm.js"

# Step 6: Git commit
echo ""
echo "📝 Step 6: Committing changes..."
git add . && git commit -m "feat: integrate multi-LLM (Claude, Ollama, HF, Grok) with fallback" || echo "⚠️ Git commit skipped (optional)"

echo ""
echo "✅ Weave complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env: amp .env"
echo "   - Set LLM_PROVIDER=claude (or ollama, hf, grok)"
echo "   - Add API keys for your chosen providers"
echo ""
echo "2. Update narrator.js:"
echo "   - See UPDATE_NARRATOR_INSTRUCTIONS.md"
echo ""
echo "3. Test:"
echo "   - npm start"
echo "   - node test-llm.js"
echo ""
echo "🔗 Provider docs:"
echo "   - Claude: https://console.anthropic.com"
echo "   - Ollama: https://ollama.ai (local)"
echo "   - HuggingFace: https://huggingface.co/settings/tokens"
echo "   - Grok: https://x.ai/api"
EOF

chmod +x multi-llm-weave.sh

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

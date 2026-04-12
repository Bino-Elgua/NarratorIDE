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
 * @param {string|object} input - Raw code string or { before, after, summary } object
 * @param {string} persona - Persona name
 * @param {string} tone - Tone name
 */
async function generateNarration(input, persona, tone) {
  const provider = process.env.LLM_PROVIDER || 'claude';
  
  let codeContext = '';
  let projectInfo = '';
  
  if (typeof input === 'object' && input.after) {
    if (input.before && input.before !== input.after) {
      codeContext = `The user changed code.\nBEFORE:\n${input.before}\n\nAFTER:\n${input.after}\n\nSUMMARY: ${input.summary || 'Updated code'}`;
    } else {
      codeContext = `Current code:\n${input.after}`;
    }
    if (input.projectContext) {
      projectInfo = `\n\n${input.projectContext}`;
    }
    if (input.gitDiff) {
      codeContext += `\n\nGIT DIFF:\n${input.gitDiff}`;
    }
  } else {
    codeContext = `Code:\n${input}`;
  }

  const prompt = `You are the ${persona} persona in ${tone} tone. 
Narrate the intent and flow of this code change in 1-3 sentences. 
Focus on WHAT changed and WHY it matters. 
Stay in character.

${codeContext}${projectInfo}`;

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

    console.error('[LLM] Claude failed. Returning placeholder.');
    return `Narration paused: ${error.message}. Please check API keys or provider configuration.`;
  }
}

function parseAnthropicResponse(response) {
  if (!response) return '';
  if (typeof response.content === 'string') return response.content.trim();
  if (Array.isArray(response.content)) {
    return response.content
      .map((block) => (typeof block.text === 'string' ? block.text : typeof block.content === 'string' ? block.content : ''))
      .join('')
      .trim();
  }
  return '';
}

function parseHuggingFaceResponse(response) {
  if (!response) return '';
  if (typeof response.generated_text === 'string') return response.generated_text.trim();
  if (Array.isArray(response) && response[0] && typeof response[0].generated_text === 'string') {
    return response[0].generated_text.trim();
  }
  return '';
}

function parseOllamaResponse(data) {
  if (!data) return '';
  if (typeof data.response === 'string') return data.response.trim();
  if (Array.isArray(data.output)) {
    return data.output
      .map((item) => {
        if (typeof item.content === 'string') return item.content;
        if (Array.isArray(item.content)) {
          return item.content.map((block) => block.text || block.content || '').join('');
        }
        return '';
      })
      .join('')
      .trim();
  }
  if (typeof data.text === 'string') return data.text.trim();
  return '';
}

function parseGrokResponse(data) {
  if (!data) return '';
  const message = data?.choices?.[0]?.message;
  if (message) {
    if (typeof message.content === 'string') return message.content.trim();
    if (Array.isArray(message.content)) {
      return message.content.map((block) => block.text || block.content || '').join('').trim();
    }
  }
  if (typeof data.output === 'string') return data.output.trim();
  if (Array.isArray(data.output)) {
    return data.output.map((block) => block.text || block.content || '').join('').trim();
  }
  return '';
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
  const output = parseAnthropicResponse(response);
  if (!output) throw new Error('Claude returned no content');
  return output;
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

  const output = parseOllamaResponse(response.data);
  if (!output) throw new Error('Ollama returned no content');
  return output;
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

  const output = parseHuggingFaceResponse(response);
  if (!output) throw new Error('HuggingFace returned no content');
  return output.replace(prompt, '').trim();
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

  const output = parseGrokResponse(response.data);
  if (!output) throw new Error('Grok returned no content');
  return output;
}

module.exports = { generateNarration };

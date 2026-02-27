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

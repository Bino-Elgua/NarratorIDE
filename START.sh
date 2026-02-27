#!/bin/bash

# Narrator IDE Startup Script

echo "🎙️  Narrator IDE - Starting..."
echo ""

# Check for .env file
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating from template..."
  cp .env.example .env
  echo ""
  echo "📝 Please configure your API keys in .env:"
  echo "   - ANTHROPIC_API_KEY (for LLM narration)"
  echo "   - ELEVENLABS_API_KEY (for text-to-speech)"
  echo ""
fi

# Check API keys
if ! grep -q "ANTHROPIC_API_KEY=sk" .env; then
  echo "⚠️  ANTHROPIC_API_KEY not configured in .env"
fi

if ! grep -q "ELEVENLABS_API_KEY=sk" .env; then
  echo "⚠️  ELEVENLABS_API_KEY not configured in .env"
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

# Start the server
echo "🚀 Starting Narrator IDE Server..."
echo "   Server: http://localhost:3000"
echo "   WebSocket: ws://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm start

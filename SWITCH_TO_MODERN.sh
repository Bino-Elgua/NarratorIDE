#!/bin/bash

# Switch Narrator IDE to Modern UI
# This updates the server to serve the modern index-modern.html by default

echo "🎨 Switching to Modern Narrator IDE UI..."

# Check if we need to modify server.js
if grep -q "index\.html" src/server.js; then
    echo "✅ Backing up original server.js..."
    cp src/server.js src/server.js.backup

    echo "✅ Updating server to serve modern UI..."
    
    # Add route for modern index if not already present
    if ! grep -q "index-modern" src/server.js; then
        # Find the line with app.use(express.static) and add route before it
        sed -i "/app\.use(express\.static('web'))/i app.get('/', (req, res) => { res.sendFile(__dirname + '/web/index-modern.html'); });" src/server.js
    fi
    
    echo "✅ Server updated!"
else
    echo "⚠️  Server might already be configured for modern UI"
fi

echo ""
echo "📋 What's included:"
echo "  ✓ Modern dark theme (Aura-inspired)"
echo "  ✓ Command palette (Ctrl+Shift+P)"
echo "  ✓ File tabs"
echo "  ✓ Persona indicator with glow"
echo "  ✓ Card-based narration history"
echo "  ✓ Resizable bottom panel"
echo "  ✓ 15+ keyboard shortcuts"
echo ""
echo "🚀 To start:"
echo "  npm start"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "💡 Key shortcuts:"
echo "  Ctrl+Shift+P  = Command Palette"
echo "  Ctrl+Shift+N  = Toggle Narration"
echo "  Ctrl+Alt+P    = Next Persona"
echo "  Ctrl+Alt+T    = Next Tone"
echo "  Ctrl+J        = Toggle Bottom Panel"
echo ""
echo "✨ Modern UI is ready!"

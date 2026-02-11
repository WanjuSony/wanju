#!/bin/bash

echo "🚀 Starting UX Research System Dev Server..."

# 1. Try to load NVM (Node Version Manager) if installed
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "Loading NVM..."
    \. "$NVM_DIR/nvm.sh"
fi

# 2. Add common Homebrew and system paths explicitly
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 3. Check if npm is now available
if command -v npm >/dev/null 2>&1; then
    echo "✅ found npm at: $(command -v npm)"
    echo "Running 'npm run dev'..."
    npm run dev
else
    echo "⚠️ 'npm' command still not found in standard paths."
    echo "Searching for npm binary manually (this may take a moment)..."
    
    # Try to find npm in typical install locations
    POSSIBLE_NPM=$(find "$HOME/.nvm" /opt/homebrew/bin /usr/local/bin -name "npm" -type f -perm +111 2>/dev/null | head -n 1)
    
    if [ -n "$POSSIBLE_NPM" ]; then
        echo "✅ Found npm at: $POSSIBLE_NPM"
        "$POSSIBLE_NPM" run dev
    else
        echo "❌ CRITICAL ERROR: Could not find Node.js/npm on your system."
        echo "Please ensure Node.js is installed."
        exit 1
    fi
fi

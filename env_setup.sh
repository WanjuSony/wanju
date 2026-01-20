#!/bin/bash
# Sources the local node environment
export PATH="$(pwd)/../.tools/node-v20.10.0-darwin-arm64/bin:$PATH"
echo "Environment loaded. Node version: $(node -v)"

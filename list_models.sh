#!/bin/bash
# Read API Key from .env.local
API_KEY=$(cat .env.local | grep GOOGLE_API_KEY | cut -d '=' -f2)

if [ -z "$API_KEY" ]; then
  echo "API Key not found in .env.local"
  exit 1
fi

curl "https://generativelanguage.googleapis.com/v1beta/models?key=$API_KEY"

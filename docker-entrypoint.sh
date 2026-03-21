#!/bin/sh
# Generate config.js from the GEMINI_API_KEY environment variable
if [ -n "$GEMINI_API_KEY" ]; then
  echo "const CONFIG = { GEMINI_API_KEY: '${GEMINI_API_KEY}' };" > /usr/share/nginx/html/config.js
  echo "[Entrypoint] Generated config.js with CONFIG object from environment."
else
  echo "[Entrypoint] Warning: GEMINI_API_KEY environment variable is not set."
fi

# Start NGINX
exec "$@"

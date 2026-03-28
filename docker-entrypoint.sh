#!/bin/sh
cat > /usr/share/nginx/html/config.js << JSEOF
const CONFIG = {
  GEMINI_API_KEY: '${GEMINI_API_KEY}',
  FIREBASE_CONFIG: {
    apiKey: '${FIREBASE_API_KEY}',
    authDomain: '${FIREBASE_AUTH_DOMAIN}',
    databaseURL: '${FIREBASE_DATABASE_URL}',
    projectId: '${FIREBASE_PROJECT_ID}',
    storageBucket: '${FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${FIREBASE_APP_ID}'
  }
};
JSEOF
echo "[Entrypoint] Generated config.js with Gemini + Firebase config."
exec "\$@"

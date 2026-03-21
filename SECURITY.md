# Security Policy

## API Key Handling

This project uses the Google Gemini API which requires an API key.

- **`config.js`** contains your API key and is **gitignored** — it will never be committed.
- **`config.example.js`** is committed as a template showing the expected format.
- **Never** hardcode API keys directly into source files.

## Setup

1. Copy `config.example.js` to `config.js`
2. Replace `'YOUR_API_KEY_HERE'` with your actual Gemini API key
3. Verify `config.js` appears in `.gitignore`

## Reporting Vulnerabilities

If you discover a security vulnerability, please open a private issue or contact the maintainer directly.

# Security Policy

## Supported Versions
| Version | Supported |
|---------|-----------|
| latest  | yes       |

## API Key Handling
- `config.js` contains API keys and is **gitignored** — never committed
- `config.example.js` is the committed template
- Keys are injected at runtime via Cloud Run environment variables
- The `docker-entrypoint.sh` generates `config.js` from env vars on container start
- Never hardcode API keys in source files

## Input Sanitisation
- All user text (leaderboard names) capped at 20 chars and inserted via `textContent` not `innerHTML`
- Board state sent to Gemini is serialised through `boardToAPIFormat()` which strips all non-primitive values
- Gemini calls rate-limited to one per 10 seconds client-side

## Content Security Policy
A strict CSP is enforced via meta tag, restricting scripts, styles, and connections to known safe origins only.

## Rate Limiting
- Gemini API calls: minimum 10s debounce between automatic calls
- Response cache: identical board states return cached results without API call
- Firebase writes: only on game completion, gated by anonymous auth

## Reporting Vulnerabilities
Open a private GitHub issue or contact the maintainer directly. We aim to respond within 48 hours.

# Minesweeper: Oracle

A reimagination of classic Minesweeper (1992) powered by **Google Gemini 2.5 Flash**. After every cell reveal, the AI Oracle analyses the board using constraint satisfaction logic and overlays a real-time probability heatmap — green (safe) to red (danger).

Play **with** an AI oracle, not against one.

## Live Demo
[minesweeper-oracle-658349117296.us-central1.run.app](https://minesweeper-oracle-658349117296.us-central1.run.app)

## Features
- AI Probability Heatmap — Gemini analyses constraint satisfaction to colour-code mine likelihood
- Strategic Hints — Ask the Oracle for a recommended next move with reasoning
- Death Narration — AI-generated dramatic narration when you hit a mine
- Live Leaderboard — Firebase Realtime Database with real-time onValue listener
- Full Accessibility — ARIA labels, keyboard navigation, screen-reader support, aria-live announcements
- Anonymous Authentication — Firebase Auth gates all leaderboard writes

## Quick Start
1. Clone the repository
2. Copy `config.example.js` to `config.js`
3. Add your Gemini API key and Firebase config to `config.js`
4. Open `index.html` in a modern browser — no build step required

## Google Services

| Service | Purpose | Integration |
|---|---|---|
| Gemini 2.5 Flash | AI probability heatmap, strategic hints, death narration | REST API via SDK |
| Firebase Authentication | Anonymous auth gates leaderboard writes, prevents spam | Firebase SDK |
| Firebase Realtime Database | Live global leaderboard with `onValue` real-time listener | Firebase SDK |
| Firebase Analytics | 9 custom game events tracked per session | Firebase SDK |
| Google Cloud Run | Production deployment, auto-scaling, HTTPS, zero cold-start cost | Infrastructure |
| Google Artifact Registry | Docker image storage and versioning | Infrastructure |
| Google Cloud Build | Container build pipeline, no-cache rebuilds | Infrastructure |
| Google Fonts | Inter + JetBrains Mono typography | CDN |

## Architecture
```
Browser → Cloud Run (nginx:alpine)
        → Gemini 2.5 Flash API (probability analysis)
        → Firebase Realtime Database (leaderboard)
        → Firebase Analytics (event tracking)
        → Firebase Auth (anonymous session)
```

## Controls
| Action | Mouse | Keyboard |
|---|---|---|
| Reveal cell | Left click | Space / Enter |
| Flag cell | Right click | F |
| Chord reveal | Middle click | C |
| Navigate | — | Arrow keys |
| Ask Oracle | Button | H |

## Project Structure
```
├── index.html          Main app entry point
├── config.js           API keys (gitignored)
├── config.example.js   Key format template
├── docker-entrypoint.sh Runtime config generation
├── Dockerfile          nginx:alpine container
├── nginx.conf          Static file server config
├── SECURITY.md         Security policy
├── DEPLOYMENT.md       Cloud Run deploy guide
├── src/
│   ├── game.js         Core Minesweeper logic (pure functions)
│   ├── gemini.js       Gemini API — analysis, hints, narration
│   ├── ui.js           DOM rendering, ARIA, keyboard controls
│   └── firebase.js     Realtime Database + Analytics + Auth
└── tests/
    ├── index.html      Browser test runner
    └── gemini.test.js  8 unit tests (console.assert)
```

## Prompt Strategy
Board state is serialised to compact JSON and sent with a strict system prompt forcing structured JSON output. Calls are debounced to 10s minimum and cached by board state hash. A full game uses 5-8 automatic API calls.

## Accessibility
- `lang="en"` on html element
- All cells: `role="gridcell"` with descriptive `aria-label` including probability
- `aria-live="polite"` announcer for game events
- Full keyboard navigation: Arrow keys, Space, F, C, H
- `prefers-reduced-motion` respected
- No colour-only indicators — text fallbacks on all states

## Security
See `SECURITY.md`. API keys are gitignored and injected via Cloud Run env vars at runtime.

## Testing
Open `tests/index.html` in browser — 8 tests run automatically, all should show PASS.

## License
MIT

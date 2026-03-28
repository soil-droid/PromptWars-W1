# Minesweeper: Oracle 🔮

A reimagination of classic Minesweeper (1992) powered by **Google Gemini 2.0 Flash**. After every cell reveal, the AI Oracle analyses the board and overlays a probability heatmap — green (safe) to red (danger) — on every hidden cell.

Play **with** an AI oracle, not against one.

## Features

- 🧠 **AI Probability Heatmap** — Gemini analyses constraint satisfaction to color-code mine likelihood
- 💡 **Strategic Hints** — Ask the Oracle for a recommended next move with reasoning
- 💀 **Death Narration** — AI-generated dramatic narration when you hit a mine
- ♿ **Full Accessibility** — ARIA labels, keyboard navigation, screen-reader support
- 🏆 **Live Leaderboard** — Real-time global scores via Firebase Realtime Database
- 🎨 **Premium Dark UI** — Glassmorphism panels, neon gradients, smooth micro-animations

## Quick Start

1. **Clone** the repository
2. **Copy** `config.example.js` → `config.js`
3. **Add** your [Gemini API key](https://aistudio.google.com/app/apikey) and Firebase config to `config.js`
4. **Open** `index.html` in a modern browser — no build step required

## Google Services

| Service | Purpose | Integration Type |
|---|---|---|
| Gemini 2.0 Flash | AI probability heatmap, hints, death narration | REST API (client-side) |
| Firebase Authentication | Anonymous auth gates leaderboard writes, prevents spam | Firebase SDK |
| Firebase Realtime Database | Live global leaderboard with `onValue` listener | Firebase SDK |
| Firebase Analytics | 9 custom game events tracked | Firebase SDK |
| Google Cloud Run | Production deployment, auto-scaling, HTTPS | Infrastructure |
| Google Artifact Registry | Docker image storage (`us-central1`) | Infrastructure |
| Google Cloud Build | Container build pipeline | Infrastructure |
| Google Fonts | Inter + JetBrains Mono typography | CDN |

## Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Reveal cell | Left click | Enter / Space |
| Flag cell | Right click | F |
| Chord reveal | Middle click / both buttons | C |
| Navigate | — | Arrow keys |

## Project Structure

```
├── index.html          Main app
├── config.js           Your API key (gitignored)
├── config.example.js   Key format template
├── DEPLOYMENT.md       Cloud Run deployment guide
├── src/
│   ├── game.js         Core Minesweeper logic (pure functions)
│   ├── gemini.js       Gemini 2.0 Flash API integration
│   ├── ui.js           DOM rendering, accessibility & analytics
│   └── firebase.js     Firebase Auth, RTDB leaderboard + Analytics
└── tests/
    ├── index.html      Test runner
    └── gemini.test.js  Unit tests
```

## License

MIT

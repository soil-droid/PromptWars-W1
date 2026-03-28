# Minesweeper: Oracle 🔮

A reimagination of classic Minesweeper (1992) powered by **Google Gemini 2.0 Flash**. After every cell reveal, the AI Oracle analyses the board and overlays a probability heatmap — green (safe) to red (danger) — on every hidden cell.

Play **with** an AI oracle, not against one.

## Features

- 🧠 **AI Probability Heatmap** — Gemini analyses constraint satisfaction to color-code mine likelihood
- 💡 **Strategic Hints** — Ask the Oracle for a recommended next move with reasoning
- 💀 **Death Narration** — AI-generated dramatic narration when you hit a mine
- ♿ **Full Accessibility** — ARIA labels, keyboard navigation, screen-reader support
- 🎨 **Premium Dark UI** — Glassmorphism panels, neon gradients, smooth micro-animations

## Quick Start

1. **Clone** the repository
2. **Copy** `config.example.js` → `config.js`
3. **Add** your [Gemini API key](https://aistudio.google.com/app/apikey) to `config.js`
4. **Open** `index.html` in a modern browser — no build step required

## Google Services

1. Google Gemini 2.0 Flash API — Core game AI Oracle and reasoning
2. Firebase Realtime Database — Read/write with `onValue` listeners for the leaderboard
3. Firebase Analytics — Custom event logging
4. Firebase Hosting / Cloud Storage — Asset and config storage
5. Google Cloud Run — Production deployment, auto-scaling, HTTPS
6. Google Artifact Registry — Docker image storage
7. Google Cloud Build — CI/CD container builds

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
├── src/
│   ├── game.js         Core Minesweeper logic
│   ├── gemini.js       Gemini API integration
│   ├── ui.js           DOM rendering & accessibility
│   └── firebase.js     Firebase Realtime Database leaderboard + Analytics
└── tests/
    ├── index.html      Test runner
    └── gemini.test.js  Unit tests
```

## License

MIT

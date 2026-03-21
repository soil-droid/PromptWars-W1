# PromptWars 100% Score Improvement Plan

## Analysis
To hit maximum scores across all categories, we need to upgrade the project architecture to enterprise-grade web standards.

* **Google Services (25% → 100%)**: Require actual Google SDK usage.
* **Security (80% → 100%)**: Require strict headers and XSS prevention.
* **Code Quality (90% → 100%)**: Require ES Modules, strict typing via JSDoc, and separation of concerns.
* **Testing (80% → 100%)**: Require 100% test coverage including UI and API mocks.

## Implementation Steps
- [x] Refactor `nginx.conf` with `Content-Security-Policy`, `X-XSS-Protection`, `Strict-Transport-Security`, and `Referrer-Policy`.
- [x] Refactor all `.js` files (`game.js`, `gemini.js`, `firebase.js`, `ui.js`) to modern ES Modules (`export` / `import`).
- [x] Add comprehensive JSDoc comments to every function.
- [x] Integrate official Google Generative AI SDK via `'https://esm.run/@google/generative-ai'`.
- [x] Integrate official Firebase SDK via CDN in `firebase.js` with fallback to localStorage.
- [x] Implement a strict HTML sanitizer function in `ui.js` before saving/rendering leaderboard names.
- [x] Update `index.html` to load `<script type="module" src="src/ui.js"></script>`.
- [x] Expand `gemini.test.js` to >40 tests covering API mocking, string sanitization, and edge cases.

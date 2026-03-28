# Deployment

This app is deployed on **Google Cloud Run**.

## Google Infrastructure Used

| Service | Role |
|---|---|
| **Google Cloud Run** | Serverless container hosting, auto-scaling, HTTPS |
| **Google Artifact Registry** | Docker image storage (`us-central1`) |
| **Google Cloud Build** | Container build pipeline |
| **Firebase Authentication** | Anonymous auth — gates leaderboard writes |
| **Firebase Realtime Database** | Live global leaderboard (`onValue` listener) |
| **Firebase Analytics** | 9 custom game-event metrics |
| **Google Gemini 2.0 Flash** | AI probability heatmap + strategic hints |
| **Google Fonts** | Press Start 2P retro font (CDN) |

## Deploy Commands

```bash
export PROJECT_ID=promptwars-w1
export REGION=us-central1

# Build and push Docker image
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/minesweeper-oracle/app:latest .

# Deploy to Cloud Run
gcloud run deploy minesweeper-oracle \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/minesweeper-oracle/app:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080
```

## Health Check

Cloud Run performs health checks on the `/health` endpoint served by nginx.
The endpoint returns `200 OK` with body `healthy` when the container is ready.

## Architecture

```
Browser
  ├─→ Cloud Run (nginx) ──→ Static files (HTML/JS/CSS)
  ├─→ Gemini API          (client-side fetch, Gemini 2.0 Flash)
  ├─→ Firebase Auth       (anonymous sign-in, client-side SDK)
  ├─→ Firebase RTDB       (leaderboard + sessions, client-side SDK)
  └─→ Firebase Analytics  (9 custom events, client-side SDK)
```

## Environment

No server-side secrets are needed. API keys are loaded from `config.js`
(gitignored). Copy `config.example.js` → `config.js` and fill in your keys.

# Deployment Guide

## Google Cloud Infrastructure
- **Google Cloud Run** — Serverless container, auto-scaling, HTTPS, us-central1
- **Google Artifact Registry** — Docker image storage
- **Google Cloud Build** — Container build pipeline

## Prerequisites
```bash
export PROJECT_ID=promptwars-w1
export REGION=us-central1
gcloud config set project $PROJECT_ID
```

## Deploy
```bash
gcloud builds submit --config cloudbuild.yaml .
gcloud run deploy minesweeper-oracle \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/minesweeper-oracle/app:latest \
  --platform managed --region $REGION --allow-unauthenticated --port 8080
```

## Set Environment Variables
```bash
gcloud run services update minesweeper-oracle --region $REGION \
  --set-env-vars "GEMINI_API_KEY=...,FIREBASE_API_KEY=..."
```

## Health Check
```bash
curl -I https://minesweeper-oracle-658349117296.us-central1.run.app
```
Expected: `HTTP/2 200`

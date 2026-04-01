# Business Twin

Business Twin is a full-stack AI pricing simulator built inside the existing Vite + React + TypeScript project.

It lets a user type a pricing change such as a discount or price increase, parses that request into structured JSON, runs a business simulation, and returns projected demand, revenue, profit, and risk.

## What It Does

- Chat-style UI for pricing scenario input
- Backend parsing endpoint at `/api/ai-parse`
- Backend simulation endpoint at `/api/simulate`
- Health endpoint at `/api/health`
- OpenAI-assisted parsing when `OPENAI_API_KEY` is configured
- Fallback parsing logic when no API key is present
- Vite proxy from frontend to backend
- Root script to run frontend and backend together

## Tech Stack

Frontend:
- Vite
- React
- TypeScript

Backend:
- Node.js
- Express
- CORS

## Project Structure

```text
runanywhere_project/
+- package.json
+- package-lock.json
+- web-starter-app/
¦  +- .env.example
¦  +- package.json
¦  +- package-lock.json
¦  +- vite.config.ts
¦  +- index.html
¦  +- server/
¦  ¦  +- index.js
¦  ¦  +- lib/
¦  ¦     +- fallbackParser.js
¦  ¦     +- openaiParser.js
¦  ¦     +- simulationEngine.js
¦  +- src/
¦  ¦  +- App.tsx
¦  ¦  +- main.tsx
¦  ¦  +- lib/
¦  ¦  ¦  +- api.ts
¦  ¦  +- components/
¦  ¦  ¦  +- ChatTab.tsx
¦  ¦  ¦  +- ModelBanner.tsx
¦  ¦  ¦  +- ToolsTab.tsx
¦  ¦  ¦  +- VisionTab.tsx
¦  ¦  ¦  +- VoiceTab.tsx
¦  ¦  +- styles/
¦  ¦  ¦  +- index.css
¦  ¦  +- hooks/
¦  ¦  +- workers/
¦  ¦  +- runanywhere.ts
¦  +- vercel.json
¦  +- tests/
```

## API Endpoints

### `GET /api/health`
Returns server status.

### `POST /api/ai-parse`
Request:

```json
{
  "input": "Offer a 10% discount on our main product line"
}
```

Response:

```json
{
  "scenario": {
    "type": "discount",
    "value": 10,
    "unit": "percent",
    "label": "Discount by 10%",
    "explanation": "A 10% discount should boost demand, while putting pressure on margin.",
    "originalInput": "Offer a 10% discount on our main product line",
    "source": "fallback"
  },
  "error": null,
  "metadata": {
    "provider": "fallback",
    "reason": "OPENAI_API_KEY is not configured."
  }
}
```

### `POST /api/simulate`
Request:

```json
{
  "scenario": {
    "type": "price_increase",
    "value": 6,
    "unit": "percent",
    "label": "Increase price by 6%",
    "explanation": "A 6% price increase should lift unit economics, but it may reduce demand.",
    "originalInput": "Raise prices by 6% for enterprise customers",
    "source": "fallback"
  }
}
```

Response:

```json
{
  "scenario": {
    "type": "price_increase",
    "value": 6,
    "unit": "percent",
    "label": "Increase price by 6%",
    "explanation": "A 6% price increase should lift unit economics, but it may reduce demand.",
    "originalInput": "Raise prices by 6% for enterprise customers",
    "source": "fallback"
  },
  "metrics": {
    "demandChangePct": -6.9,
    "revenueChangePct": 2.2,
    "profitChangePct": 3.3,
    "risk": "medium"
  },
  "narrative": "The price increase should improve monetization, but a demand drop of about 6.9% keeps the overall risk medium."
}
```

## Environment Variables

Create `web-starter-app/.env` and add:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=5000
```

Notes:
- The app still works without `OPENAI_API_KEY`
- Without it, parsing uses fallback regex-based business logic

## Install

From the workspace root:

```powershell
cd e:\PROJECTS\runanywhere_project
npm install
```

From the app folder:

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
npm install
```

## Run

Run both frontend and backend together:

```powershell
cd e:\PROJECTS\runanywhere_project
npm run dev
```

Run frontend only:

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
npm run dev
```

Run backend only:

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
node server/index.js
```

## Build

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
npm run build
```

## Current Frontend Behavior

- User enters a pricing instruction in the chat box
- Frontend calls `/api/ai-parse`
- Frontend sends the parsed scenario to `/api/simulate`
- UI renders revenue, profit, demand, and risk cards
- Loading and error states are shown in the chat flow

## Verification Completed

The current implementation has been verified with:
- successful frontend production build
- working Express server on port `5000`
- successful `GET /api/health`
- successful parse and simulate endpoint tests

## Deployment Note

This repo contains an Express backend and a Vite frontend, so deployment requires:
- a frontend host for the Vite app
- a Node host for the Express server
- environment variables on the backend host

A live deployment link has not been created from this environment because external deployment access and hosting credentials are not available here.

## Suggested Cleanup

If you want this repo to be only Business Twin, the old RunAnywhere starter files can be removed after review. See the cleanup list I provided separately.

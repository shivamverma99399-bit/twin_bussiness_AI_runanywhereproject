# RunAnywhere Business Twin Workspace

🔗 Live Demo: https://web-starter-app-kappa.vercel.app
This repository is a small full-stack workspace built around a pricing simulation app called Business Twin.

The current user-facing flow is simple:

1. A user types a pricing change such as "Offer a 10% discount".
2. The backend parses that instruction into structured scenario data.
3. The backend runs a lightweight simulation.
4. The frontend shows projected demand, revenue, profit, and risk.

The project also still includes parts of the original RunAnywhere Web SDK starter app, including model setup and demo components for chat, vision, voice, and tool calling. At the moment, the main app renders only the Business Twin chat experience.

## What Is In This Repo

- A root workspace that can start both frontend and backend together
- A Vite + React + TypeScript app in `web-starter-app`
- An Express backend in `web-starter-app/server`
- Business Twin parsing and simulation APIs
- RunAnywhere SDK setup for on-device model loading and multimodal demos

## Current App Status

The active application is Business Twin.

The main screen is defined in `web-starter-app/src/App.tsx` and currently renders only `ChatTab`, which powers the pricing simulation flow.

The repo still contains these additional components:

- `ToolsTab.tsx`
- `VisionTab.tsx`
- `VoiceTab.tsx`
- `ModelBanner.tsx`
- `runanywhere.ts`

Those are useful if you want to expand the app again, but they are not mounted in the current UI.

## Workspace Structure

```text
runanywhere_project/
|- package.json
|- package-lock.json
|- README.md
|- web-starter-app/
|  |- package.json
|  |- package-lock.json
|  |- vite.config.ts
|  |- vercel.json
|  |- index.html
|  |- README.md
|  |- src/
|  |  |- App.tsx
|  |  |- main.tsx
|  |  |- runanywhere.ts
|  |  |- lib/
|  |  |  |- api.ts
|  |  |- hooks/
|  |  |  |- useModelLoader.ts
|  |  |- components/
|  |  |  |- ChatTab.tsx
|  |  |  |- ModelBanner.tsx
|  |  |  |- ToolsTab.tsx
|  |  |  |- VisionTab.tsx
|  |  |  |- VoiceTab.tsx
|  |  |- workers/
|  |  |  |- vlm-worker.ts
|  |  |- styles/
|  |     |- index.css
|  |- server/
|  |  |- index.js
|  |  |- lib/
|  |     |- fallbackParser.js
|  |     |- openaiParser.js
|  |     |- simulationEngine.js
|- node_modules/
```

## Tech Stack

Frontend:

- React 19
- TypeScript
- Vite 6

Backend:

- Node.js
- Express 5
- CORS

AI and model infrastructure:

- `@runanywhere/web`
- `@runanywhere/web-llamacpp`
- `@runanywhere/web-onnx`

Workspace tooling:

- `concurrently`

## How The App Works

### Frontend flow

The Business Twin experience lives in `web-starter-app/src/components/ChatTab.tsx`.

When a user submits text:

1. The frontend calls `POST /api/ai-parse`.
2. The returned structured scenario is sent to `POST /api/simulate`.
3. The UI renders a summary narrative and KPI cards for:
   - revenue change
   - profit change
   - demand change
   - risk

### Backend flow

The Express server lives in `web-starter-app/server/index.js`.

It exposes:

- `GET /api/health`
- `POST /api/ai-parse`
- `POST /api/simulate`

### Parsing behavior

`web-starter-app/server/lib/openaiParser.js` handles instruction parsing.

Behavior:

- If `OPENAI_API_KEY` is configured, the server calls the OpenAI Responses API.
- If OpenAI is unavailable or parsing fails, it falls back to regex-based parsing.
- If no API key is configured, fallback parsing is used immediately.

The parser currently supports two scenario types:

- `discount`
- `price_increase`

### Simulation behavior

`web-starter-app/server/lib/simulationEngine.js` applies simple deterministic business rules to produce:

- `demandChangePct`
- `revenueChangePct`
- `profitChangePct`
- `risk`

This is a simulation heuristic, not a predictive ML model.

## Installation

### Prerequisites

- Node.js 18 or newer recommended
- npm

### Install workspace dependencies

From the repo root:

```powershell
cd e:\PROJECTS\runanywhere_project
npm install
```

### Install app dependencies

From the app directory:

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
npm install
```

## Running The Project

### Run frontend and backend together

From the root workspace:

```powershell
cd e:\PROJECTS\runanywhere_project
npm run dev
```

That root script starts:

- Vite frontend from `web-starter-app`
- Express backend from `web-starter-app/server`

### Run only the frontend

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
npm run dev
```

### Run only the backend

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
npm run backend
```

## Build

Build the frontend app with:

```powershell
cd e:\PROJECTS\runanywhere_project\web-starter-app
npm run build
```

This runs:

- TypeScript project build
- Vite production build

The Vite config also copies required WASM assets for the RunAnywhere backends into the output bundle.

## Available Scripts

Root `package.json`:

- `npm run dev`
  Starts frontend and backend together with `concurrently`

`web-starter-app/package.json`:

- `npm run dev`
  Starts the Vite dev server
- `npm run backend`
  Starts the Express API server
- `npm run build`
  Builds the frontend for production
- `npm run preview`
  Serves the built frontend locally

## Environment Variables

The backend can use OpenAI for parsing pricing instructions.

Create a file at `web-starter-app/.env` if you want AI-assisted parsing:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1/responses
PORT=5000
```

Notes:

- `OPENAI_API_KEY` is optional
- If the API key is missing, the app still works through fallback parsing
- `OPENAI_MODEL` defaults to `gpt-4.1-mini`
- `OPENAI_BASE_URL` defaults to the OpenAI Responses API endpoint
- `PORT` defaults to `5000`

## API Reference

### `GET /api/health`

Returns backend health information.

Example response:

```json
{
  "status": "ok",
  "service": "business-twin-server",
  "timestamp": "2026-04-01T18:30:00.000Z"
}
```

### `POST /api/ai-parse`

Converts natural-language pricing input into a normalized scenario.

Request:

```json
{
  "input": "Offer a 10% discount on our main product line"
}
```

Example response:

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

Runs the pricing simulation for a parsed scenario.

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

Example response:

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

## RunAnywhere SDK Pieces Still Present

Even though the current app only mounts the Business Twin flow, the repo still contains reusable RunAnywhere SDK code for:

- language model loading
- multimodal vision inference
- voice pipeline orchestration
- local tool calling demos
- WASM asset handling

The model catalog is defined in `web-starter-app/src/runanywhere.ts` and includes:

- Liquid AI LFM2 350M
- Liquid AI LFM2 1.2B Tool
- LFM2-VL 450M
- Whisper Tiny English
- Piper TTS Lessac
- Silero VAD v5

If you plan to re-enable the tabs in the UI, most of the building blocks are already here.

## Development Notes

### Proxy behavior

`web-starter-app/vite.config.ts` currently proxies `/api` requests to:

```text
https://twin-bussiness-ai-runanywhereproject.onrender.com
```

That means the frontend dev server is configured to forward API requests to a remote backend instead of the local Express server.

This is important because the root `npm run dev` script starts a local backend, but the current Vite proxy points somewhere else. If you want the frontend to talk to your local API during development, update the proxy target to your local server, typically `http://localhost:5000`.

### COOP/COEP headers

The Vite dev server sets:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

These headers are commonly needed for browser-side WASM and model execution scenarios.

## Known Limitations

- The mounted UI currently exposes only the Business Twin chat flow
- The simulation engine is heuristic and intentionally simplified
- Fallback parsing only recognizes a narrow set of pricing patterns
- Local frontend/backend development is slightly confusing because the Vite proxy currently points to a remote Render backend

## Suggested Next Improvements

- Point the Vite proxy to the local backend for smoother local development
- Add a `.env.example` file for backend configuration
- Decide whether to keep or remove the unused RunAnywhere demo tabs from the current app shell
- Add automated tests for parsing and simulation endpoints
- Add deployment instructions for frontend and backend separately

## Related Files

- [package.json](e:\PROJECTS\runanywhere_project\package.json)
- [README.md](e:\PROJECTS\runanywhere_project\README.md)
- [App.tsx](e:\PROJECTS\runanywhere_project\web-starter-app\src\App.tsx)
- [ChatTab.tsx](e:\PROJECTS\runanywhere_project\web-starter-app\src\components\ChatTab.tsx)
- [api.ts](e:\PROJECTS\runanywhere_project\web-starter-app\src\lib\api.ts)
- [index.js](e:\PROJECTS\runanywhere_project\web-starter-app\server\index.js)
- [openaiParser.js](e:\PROJECTS\runanywhere_project\web-starter-app\server\lib\openaiParser.js)
- [fallbackParser.js](e:\PROJECTS\runanywhere_project\web-starter-app\server\lib\fallbackParser.js)
- [simulationEngine.js](e:\PROJECTS\runanywhere_project\web-starter-app\server\lib\simulationEngine.js)
- [vite.config.ts](e:\PROJECTS\runanywhere_project\web-starter-app\vite.config.ts)

## Summary

This workspace currently functions best as a Business Twin pricing simulation app with optional AI-assisted parsing, while still carrying useful RunAnywhere SDK starter code for future expansion into broader on-device AI features.

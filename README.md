# Makesmith

Makesmith helps you turn a hardware idea into a build plan. Describe what you want to make, get a structured first design from OpenAI, then grow the plan through research, parts, CAD, instructions, checks, and simulation.

> **Phase 1 prototype:** the idea intake and OpenAI-backed design workspace are working. Parts, Manual, 3D Files, Checks, and Simulation are present as honest workspaces for later phases; they do not claim to generate those outputs yet.

## Project timeline

- **Project start:** 2026-11-14 04:51 CST
- **Phase 1 status:** implementation and deployment configuration are ready locally; live hosting is not yet connected.
- **Project end:** pending completion of Phases 1–5.

## Stack

- Frontend: Next.js App Router, React, TypeScript; deploy from `apps/web` to Vercel.
- Backend: Python FastAPI; deploy from `apps/api` to Render or Railway.
- AI: OpenAI Responses API. The default design model is GPT-6 Astra; the configured lower-cost model for smaller tasks is GPT-6 Luna. Model IDs can be changed through environment variables.
- Research in Phase 2: OpenAI's built-in web search tool, with source citations displayed alongside research.

The backend uses strict structured output for a single normalized design object. It caches successful designs by the exact trimmed idea for the life of the API process. The OpenAI API key stays on the server and is never sent to the browser. This app has no user accounts or saved projects; run one active project session at a time.

## Run locally

Use Python 3.10+ and Node.js 20.9+.

### 1. Start the API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `OPENAI_API_KEY` in `apps/api/.env`, then run:

```bash
uvicorn --env-file .env app.main:app --reload --port 8000
```

The API health check is `http://localhost:8000/health`.

### 2. Start the web app

In another terminal:

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` if the API is not at `http://localhost:8000`.

### Tests and production build

```bash
cd apps/api
python -m unittest discover -s tests -v
```

```bash
cd apps/web
npm test
npm run build
```

## Deploy

### API on Render

1. Connect the public `makesmith` repository to Render and choose the Blueprint at `apps/api/render.yaml`.
2. Set `OPENAI_API_KEY` in the Render service environment. Keep it private; do not add it to GitHub or Vercel.
3. Set `WEB_ORIGINS` to the deployed Vercel origin (for example, `https://makesmith.example`); include `http://localhost:3000` while developing locally.
4. Render builds `apps/api/Dockerfile` and checks `/health`.

### Web on Vercel

1. Import the same repository into Vercel.
2. Set the project Root Directory to `apps/web`.
3. Set `NEXT_PUBLIC_API_URL` to the Render API origin, without a trailing slash.
4. Deploy. The Next.js build configuration is in `apps/web/vercel.json`.

## Phase 1 API contract

`POST /api/design`

```json
{"idea":"A compact indoor garden that waters itself"}
```

The response is `{ "design": { ... }, "cached": false }`. `design` contains `idea`, `summary`, `components`, `parts`, `connections`, `power`, and `dimensions`. The same normalized result is returned with `cached: true` for a repeated idea.

## Roadmap

1. **Phase 1:** repository, deployable web and API apps, idea box, six workspaces, OpenAI design connection. *(Current milestone.)*
2. **Phase 2:** defaulted follow-up questions, feasibility and alternatives, live research through OpenAI web search, structured design.
3. **Phase 3:** sourced parts list, CadQuery/STL workflow, Three.js viewer, assembly manual, PDF export.
4. **Phase 4:** power/weight/fit/strength checks, project-specific MuJoCo WASM simulation, explained success estimate.
5. **Phase 5:** test several hardware ideas and an impossible one, stage-by-stage progress, polish, and record the project completion time above.

Later phases must keep using the structured design as their shared source of truth. The app should remain open to hardware ideas without hardcoded product categories.

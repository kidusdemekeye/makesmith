# Makesmith

Makesmith turns a hardware idea into a researched, structured build plan. Describe a device, review the feasibility questions, then use one design record to view researched parts, assembly instructions, custom printable geometry, engineering checks, and an optional browser simulation.

## Project timeline

- **Project start:** 2026-11-14 04:51 CST
- **Project end:** pending final deployment verification.

## Live app

- Web: [makesmith.vercel.app](https://makesmith.vercel.app)
- API: [makesmith-api.onrender.com](https://makesmith-api.onrender.com)
- Health: [makesmith-api.onrender.com/health](https://makesmith-api.onrender.com/health)

## What works

- OpenAI feasibility check with four editable questions and defaults, impossible-idea alternatives, and a safety refusal path.
- OpenAI Responses API with OpenAI's built-in web search for sourced parts, datasheets, connections, dimensions, and a single structured JSON design.
- Parts list with exact search links and citations; no live price scraping.
- CadQuery code validation, bounded subprocess compilation, up to three AI repair attempts, downloadable STL files, and Three.js part/assembly viewer.
- Numbered, explanatory assembly manual with a browser print-to-PDF option.
- Deterministic power, battery runtime, weight, fit, and basic axial-strength checks. Missing numeric inputs are shown as unknown.
- Optional MuJoCo WebAssembly test using the model and test description attached to the design. It reports whether that narrow test passed, confidence, and reasons. A pass is not a probability that a real device will work or a substitute for physical testing.
- A single browser session, no accounts, and process-local response caching. No spend cap is configured.

The service refuses requests to design weapons or support violent attacks. The prototype is a planning aid; verify component ratings, fit, and safety before building or using a device.

## Stack

- Frontend: Next.js, React, TypeScript, Three.js, and official MuJoCo WebAssembly bindings; deploy from `apps/web` to Vercel.
- Backend: Python FastAPI and CadQuery; deploy from `apps/api` to Render or Railway.
- AI: OpenAI Responses API. `OPENAI_DESIGN_MODEL` defaults to `gpt-6-astra`; `OPENAI_SMALL_MODEL` defaults to `gpt-6-luna`. Set `OPENAI_API_KEY` only in the API service environment.
- Research: OpenAI's built-in `web_search` tool; only cited HTTP(S) results are included as sources.

The backend cache lasts for the lifetime of its process. Designs and answers are held in the browser session and are not saved as user projects.

## Run locally

Use Python 3.10+ and Node.js 20.9+.

### API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add `OPENAI_API_KEY` to `apps/api/.env`, then start the server:

```bash
uvicorn --env-file .env app.main:app --reload --port 8000
```

### Web app

In another terminal:

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` in `.env.local` if the API is not at `http://localhost:8000`. The dev and build commands copy the MuJoCo runtime files from the installed package into Next.js's public assets.

## Tests and production build

```bash
cd apps/api
PYTHONPATH=../.. python -m pytest tests -q
```

```bash
cd apps/web
npm test
npm run build
```

The repository's deterministic acceptance fixtures cover a drone, headphones, a blood pressure monitor, a robotic arm, and an impossible idea without spending tokens on live AI calls.

## Deployment configuration

The public GitHub repository is `kidusdemekeye/makesmith`; `main` is connected to the deployments.

### Render API

1. Create a Blueprint using `apps/api/render.yaml`.
2. Set `OPENAI_API_KEY` in the API service environment and keep it out of GitHub and Vercel.
3. Set `WEB_ORIGINS` to `https://makesmith.vercel.app` (and add `http://localhost:3000` for local development).
4. The service uses `apps/api/Dockerfile` and the `/health` endpoint.

### Vercel web app

1. Set the project root directory to `apps/web`.
2. Set `NEXT_PUBLIC_API_URL` to `https://makesmith-api.onrender.com`.
3. Use `npm run build` as configured in `apps/web/vercel.json`.

## Scope and limitations

- No user accounts, saved projects, live pricing, or camera-based build checking.
- Parts and research depend on the current search response and cited sources; verify availability and compatibility.
- CAD output is limited to the supported CadQuery operations and per-process resource bounds.
- Engineering checks use only numeric inputs in the structured design. They do not replace a full electrical, structural, or regulatory review.
- Simulation runs a small project-specific MJCF test in the browser. Unsupported or missing models remain explicitly unavailable; the score summarizes the stated test only.

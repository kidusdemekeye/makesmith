# Makesmith Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working Phase 1 Makesmith monorepo with a Next.js idea-to-results interface, FastAPI design endpoint backed by Claude, six result tabs, local run instructions, and a clear spending cap.

**Architecture:** Keep `apps/web` and `apps/api` independently runnable. The browser submits a hardware idea to FastAPI; the API validates input, guards a session-level $20 estimated-spend ceiling, requests a structured design from Claude, and returns normalized JSON. The UI renders that JSON in Design and shows useful phase-specific empty states in Parts, Manual, 3D Files, Checks, and Simulation.

**Tech Stack:** Next.js App Router, TypeScript, React, FastAPI, Pydantic, Anthropic Messages API, Python unittest/pytest and frontend unit/build checks.

**Spec:** User-provided Makesmith project brief in this conversation; Phase 1 only.

## Global Constraints

- `PROJECT: "Makesmith" - a web app for the DSU Ignite hackathon. It must be a real working prototype, not a demo.`
- `Phase 1: repo, both apps deployed, idea box, results tabs (Design, Parts, Manual, 3D Files, Checks, Simulation), AI connected.`
- `STACK: Next.js frontend (Vercel), Python FastAPI backend (Render or Railway), Claude API (Sonnet for design, Haiku for small tasks), a web search API, CadQuery, Three.js, MuJoCo WASM.`
- `CONSTRAINTS: $20 total API budget - cache responses and add a spending cap. No user accounts; one session at a time. Out of scope: camera build-checking, live prices, saved projects.`
- `GITHUB: Create a new public repo called "makesmith". Commit after every step with clear messages.`

## Review Focus

- Blank or oversized idea input; reject clearly and keep the UI usable.
- Missing or invalid Anthropic credentials; return an actionable error without leaking secrets.
- Claude timeout, non-2xx response, and malformed JSON; return a safe error, do not cache it, and do not charge estimated spend.
- Duplicate ideas and cap exhaustion; reuse cached result and refuse spend beyond the $20 session limit.
- Unexpected or missing design fields; normalize output to one stable JSON contract before display.

## File Structure

- `apps/api/app/main.py`: FastAPI routes, CORS, health, design request and response.
- `apps/api/app/design.py`: Claude client boundary, cache, spend guard, and normalization.
- `apps/api/tests/test_design.py`: request validation, Claude response handling, cache, and budget tests.
- `apps/api/requirements.txt`, `apps/api/Dockerfile`, `apps/api/render.yaml`: API runtime and deployment configuration.
- `apps/web/app/page.tsx`, `apps/web/app/globals.css`: idea form, progress/error states, result navigation and content.
- `apps/web/app/layout.tsx`: app metadata and global shell.
- `apps/web/lib/api.ts`, `apps/web/lib/tabs.ts`: typed API contract and tab definitions.
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/vercel.json`: frontend runtime/deploy configuration.
- `README.md`: setup, environment, architecture, budget behavior, and project start timestamp.
- `docs/superpowers/plans/2026-11-14-makesmith-phase-1.md`: this plan.

## Tasks

### Task 1: API contract, Claude connection, cache, and spending guard

**Files:**
- Create: `apps/api/app/__init__.py`
- Create: `apps/api/app/design.py`
- Create: `apps/api/app/main.py`
- Create: `apps/api/tests/test_design.py`
- Create: `apps/api/requirements.txt`

**Interfaces:**
- Produces `POST /api/design` accepting `{"idea": string}` and returning `{"design": object, "cached": boolean}`.
- Design response includes `idea`, `summary`, `components`, `parts`, `connections`, `power`, and `dimensions`; arrays/objects default empty and all fields are JSON serializable.
- `GET /health` returns `{"status":"ok"}`.
- A process-local exact-idea cache prevents duplicate API calls; estimated successful request cost is accumulated per process/session and new requests are refused if estimated total would exceed $20.
- Claude key and model come from `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (default Claude Sonnet model configured in README); credentials never appear in errors.

- [ ] **Step 1: Write failing unit tests** for input validation, Claude structured output normalization, missing-key handling, duplicate caching, and refusal before the $20 cap.
- [ ] **Step 2: Run `python3 -m unittest discover -s apps/api/tests -v`;** confirm failures are due to missing API implementation.
- [ ] **Step 3: Implement** the typed request/response boundary, injectable Claude HTTP transport, cache, conservative cost estimate and app routes. Keep external calls timeout-bounded; only cache and account for valid successful output.
- [ ] **Step 4: Run the API tests** and confirm all pass, including malformed upstream data and the budget boundary.
- [ ] **Step 5: Commit** as `feat(api): add Claude-backed design endpoint`.

### Task 2: Next.js idea-to-design interface and six tabs

**Files:**
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/tabs.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/vercel.json`

**Interfaces:**
- `designIdea(idea: string): Promise<DesignResult>` posts to `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).
- The app has an idea text field and submit action, plus Design, Parts, Manual, 3D Files, Checks, Simulation tabs.
- Design renders normalized response fields. Other tabs show concise, accurate Phase 1 readiness states; no fake generated outputs.
- Loading, blank-input, and API-error states are visible and accessible.

- [ ] **Step 1: Write failing frontend tests** proving all six tabs are defined and API errors/successes are handled by the typed client.
- [ ] **Step 2: Run the frontend unit test command;** confirm it fails because the tested client/tab modules are absent.
- [ ] **Step 3: Implement** the client, tabs, accessible form, design rendering, tab empty states, and responsive styling.
- [ ] **Step 4: Run frontend unit tests and `npm run build`;** confirm both pass.
- [ ] **Step 5: Commit** as `feat(web): add idea intake and design workspace`.

### Task 3: Deploy configuration, setup documentation, and Phase 1 integration

**Files:**
- Create: `README.md`
- Create: `apps/api/Dockerfile`
- Create: `apps/api/render.yaml`
- Create: `apps/web/.env.example`
- Create: `apps/api/.env.example`
- Create: root `.gitignore`

**Interfaces:**
- Local start commands run API at port 8000 and web at port 3000.
- Render and Vercel settings are committed and can be connected to the GitHub repository without code changes.
- README records project start time exactly as `2026-11-14 04:51 CST` and identifies the current Phase 1 finish time when implementation is complete.

- [ ] **Step 1: Write failing documentation/config checks** for required setup commands, environment variable names, start timestamp and deployment roots.
- [ ] **Step 2: Run the config checks;** confirm they fail before these files exist.
- [ ] **Step 3: Add** env templates, service config, Dockerfile, gitignore, and README with realistic setup and deployment steps.
- [ ] **Step 4: Run all API and frontend checks plus config checks;** report any unavailable toolchain honestly.
- [ ] **Step 5: Commit** as `docs: add Phase 1 setup and deployment configuration`.

## Self-Review

- Phase 1 coverage: repo scaffold, API AI connection, interface, six result tabs, deployment configs, README/start time, and spend cap are assigned to the three tasks.
- Phase 2–5 workflows are deliberately excluded from this Phase 1 plan and remain future work.
- Shared interface check: API response contract (Task 1 producer) matches frontend `DesignResult` and API client (Task 2 consumer).
- Deployment requires external Vercel/Render accounts and credentials; repository configuration is included, while actual service creation is contingent on available authorized integrations.

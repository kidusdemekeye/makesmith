# Makesmith Phases 2–5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Makesmith's intake, research, structured hardware design, fabrication artifacts, manual, checks, simulation, and polished prototype flow.

**Architecture:** Keep FastAPI as the single source of truth for intake and the versioned `Design` contract. The Next.js session stores one accepted design and its derived views; backend adapters isolate OpenAI, CAD compilation, and deterministic checks. Use browser libraries only for rendering and the MuJoCo client model.

**Tech Stack:** Next.js, TypeScript, React Three Fiber/Three.js, FastAPI, Pydantic, OpenAI Responses API + web search, CadQuery, MuJoCo WebAssembly.

**Spec:** `docs/superpowers/specs/2026-11-14-makesmith-phases-2-5.md`

## Global Constraints

- Use OpenAI API for all AI features and built-in web search for the research step.
- Cache repeated AI requests; there is no spend cap or live-price scraping.
- Keep the app account-free with one active browser session and no saved projects.
- Use one structured JSON `Design` object as the source for every downstream tab.
- Ask four skippable questions with defaults; do not hardcode product categories.
- Generate and compile CadQuery with no more than three repair attempts.
- Report assumptions and unknowns in checks and simulation; never imply certification or physical validation.
- Do not generate actionable weapon or violent-attack designs.
- If time is short, omit PDF export, then per-step renders, then simulation.
- Keep README start time `2026-11-14 04:51 CST`; write end time only at actual completion.

## Review Focus

- Empty/very long ideas, malformed answers, or prompt injection should return validation errors and never reach unsafe shell execution; Task 1 covers validation and Task 4 covers code isolation.
- A web search result may be missing, stale, or contain irrelevant source URLs; Task 2 must keep only validated HTTP(S) citations and disclose research gaps.
- Partial or internally inconsistent electrical/mechanical data must yield unknown checks and visible assumptions rather than invented certainty; Task 6 tests missing data.
- Generated CAD may be syntactically valid but malicious or computationally expensive; Task 4 tests forbidden imports and bounded compilation.
- API cold-starts and AI errors should preserve the user's idea/answers and report the stage that failed; Task 3 tests progress/error states.

---

### Task 1: Intake and feasibility API

**Files:**
- Create `apps/api/app/intake.py`
- Modify `apps/api/app/main.py`
- Test `apps/api/tests/test_intake.py`, `apps/api/tests/test_api.py`

**Interfaces:**
- Produces `POST /api/intake` accepting `{idea}` and returning `{feasibility, explanation, alternatives, questions}`. Four questions have stable IDs `budget`, `size`, `purpose`, `skill_level`, each with `default` and `options`.
- The response is typed/validated; alternatives are empty unless infeasible, then contain 2–3 ideas.

- [ ] Write tests for defaults, safe impossible ideas, unsafe ideas, malformed model output, and API validation.
- [ ] Run `pytest apps/api/tests/test_intake.py apps/api/tests/test_api.py -q`; expected: missing endpoint/function failures.
- [ ] Implement cached small-model OpenAI intake with a strict schema and request validation.
- [ ] Re-run targeted tests and full API suite; expected: all pass.
- [ ] Commit `feat: add idea intake and feasibility checks`.

### Task 2: Web-researched structured design

**Files:**
- Modify `apps/api/app/design.py`, `apps/api/app/main.py`
- Modify `apps/api/tests/test_design.py`, `apps/api/tests/test_api.py`

**Interfaces:**
- `POST /api/design` accepts `{idea, answers}` and returns `{design, cached}`. Preserve the existing one-string compatibility only if existing tests/client need it.
- `Design` adds `research`, `custom_parts`, `manual`, and `assumptions`; retain existing components/parts/connections/power/dimensions.
- Each part carries exact name/specification, quantity, search URL, and source URLs; each citation is HTTP(S).

- [ ] Add tests proving the output schema, answers in cache key, research citations, strict missing-field rejection, and no unsafe design generation.
- [ ] Run `pytest apps/api/tests/test_design.py apps/api/tests/test_api.py -q`; expected: failures for new contract.
- [ ] Use OpenAI Responses API built-in `web_search` with required tool choice and structured output; cache by normalized idea+answers; normalize search links.
- [ ] Re-run targeted and full API tests; expected: all pass.
- [ ] Commit `feat: research and return complete hardware designs`.

### Task 3: End-to-end intake and progressive frontend

**Files:**
- Modify `apps/web/lib/api.ts`, `apps/web/app/page.tsx`, `apps/web/app/globals.css`
- Modify `apps/web/app/page.test.tsx`, `apps/web/lib/api.test.ts`

**Interfaces:**
- `getIntake(idea)` and `designIdea(idea, answers)` reflect the backend contracts.
- UI state order is idea → questions/alternatives → research/design progress → result tabs; one `Design` powers every tab.

- [ ] Add tests for intake defaults, answer editing/skipping, selecting an alternative, progressive status, retained idea on error, and result data from the single design.
- [ ] Run targeted Vitest tests; expected: missing flow/API behavior failures.
- [ ] Implement accessible responsive flow, stage progress and result tabs.
- [ ] Run full frontend suite and production build; expected: pass.
- [ ] Commit `feat: guide users from idea to researched design`.

### Task 4: CAD generation, bounded compilation, and 3D viewer

**Files:**
- Create `apps/api/app/cad.py`, `apps/api/tests/test_cad.py`
- Modify `apps/api/app/main.py`, `apps/api/requirements.txt`, `apps/api/Dockerfile`
- Create `apps/web/components/ModelViewer.tsx`, `apps/web/components/ModelViewer.test.tsx`
- Modify web package manifest/lock and 3D Files tab.

**Interfaces:**
- `POST /api/cad` accepts the selected `Design`; returns generated STL metadata and parts/assembly references.
- CAD compiler accepts only bounded CadQuery code, runs in a resource-limited child process, and retries generation/repair at most three times.
- `ModelViewer` takes mesh URLs plus assembly transforms and renders parts/assembly.

- [ ] Test allowed CAD, invalid code, denied imports/builtins, timeout, compile failure/retry limit, and assembly output.
- [ ] Run `pytest apps/api/tests/test_cad.py -q`; expected: missing module/endpoint failures.
- [ ] Implement isolated compile and retry lifecycle. If safe isolation is not viable on Render, return a clear unavailable message and continue to Phase 5; never execute unrestricted AI code in-process.
- [ ] Test ModelViewer empty state and renders mesh/assembly; run frontend suite/build.
- [ ] Commit `feat: generate and preview custom cad parts`.

### Task 5: Parts and build manual

**Files:**
- Create `apps/web/components/PartsList.tsx`, `apps/web/components/BuildManual.tsx`, related tests.
- Modify results tabs and print styles.

**Interfaces:**
- Parts and manual components consume `Design` only, never regenerate/reinvent facts.
- Manual steps expose number/title, part names, tools, action, reason, common mistakes.

- [ ] Test source/search links, no price field, quantities, ordered steps, empty states, and printable layout.
- [ ] Run focused Vitest tests; expected: component missing failures.
- [ ] Implement parts/manual views and browser print-to-PDF affordance (omit generated PDF artifact if schedule requires).
- [ ] Run frontend suite/build; expected: pass.
- [ ] Commit `feat: show sourced parts and build instructions`.

### Task 6: Deterministic engineering checks

**Files:**
- Create `apps/api/app/checks.py`, `apps/api/tests/test_checks.py`
- Modify API route and checks tab.
- Create frontend checks component/tests.

**Interfaces:**
- `POST /api/checks` accepts `Design`; returns named checks with `status` (`pass`, `warning`, `unknown`), result, assumptions, and reason.
- Compute power budget, battery life, total weight, fit, and basic strength only when required numeric data exists.

- [ ] Test known power/runtime/weight arithmetic, fit/strength unknowns, inconsistent data warnings, and invalid input.
- [ ] Run `pytest apps/api/tests/test_checks.py -q`; expected: missing endpoint/function failures.
- [ ] Implement deterministic calculations with units and explicit unknown output.
- [ ] Test UI status and assumptions; run API/frontend suites.
- [ ] Commit `feat: calculate transparent engineering checks`.

### Task 7: Browser MuJoCo simulation

**Files:**
- Create `apps/web/components/Simulation.tsx`, tests and MuJoCo integration worker.
- Add official MuJoCo WASM dependencies/assets and licensing notices.

**Interfaces:**
- Simulation input derives from `Design`; show score, confidence, test, reasons, limitations, and pending/unsupported state.
- Never claim simulation validates a real device.

- [x] Test supported model, unsupported model, and low-confidence/unavailable output.
- [x] Verify official MuJoCo browser/WASM API and runtime behavior before choosing integration.
- [x] Implement one general baseline simulation from structured component/mechanical properties; report unknowns honestly.
- [x] Run frontend suite/build and WASM runtime smoke test; simulation loads a model and reports its bounded test result or explicit unsupported state.
- [x] Commit `feat: run browser-based mujoco simulation`.

### Task 8: Full workflow, polish, README, release

**Files:**
- Update app, `README.md`, deployment config, workflow fixtures/tests.

**Interfaces:**
- Add deterministic workflow fixtures for drone, headphones, blood pressure monitor, robotic arm, and impossible idea.
- README records OpenAI setup, deployment URLs, workflow, limitations, and final completion time.

- [x] Add deterministic acceptance fixtures for all five prompt classes and stage-by-stage loading/errors.
- [x] Run complete API/frontend suites, production build, and local production smoke test. Docker is not installed in the environment; verify the API container through Render's deployment build.
- [x] Polish responsive layout and accessibility; finalize README with current local time only after all acceptance checks pass.
- [ ] Commit `docs: complete Makesmith prototype and deployment guide`.
- [ ] Deploy/push the reviewed completed branch and verify health plus live workflow.

## Completion

Whole branch review checks safety, API schema, deterministic checks, UI data consistency, deployment defaults, and unsupported simulation behavior. Fix critical/important findings test-first. Merge to `main` and verify live deployment only after that review and local acceptance suite.

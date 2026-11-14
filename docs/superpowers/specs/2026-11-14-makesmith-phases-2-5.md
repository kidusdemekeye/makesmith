# Makesmith Phases 2–5 Specification

## Goal

Turn the live Phase 1 Makesmith deployment into a working, general-purpose hardware planning prototype: clarify an idea, check physical feasibility, research real references, produce one structured design, and derive build artifacts and engineering checks from that design.

## User flow

1. A person enters a hardware idea, then receives four skippable questions (budget, size, purpose, skill level), each with a useful default.
2. The app flags physically impossible or materially underspecified concepts with a clear explanation and two or three realistic, user-selectable alternatives. Ordinary ideas proceed without category-specific handling.
3. OpenAI Responses API web search supplies real sources for the design. No unsupported part specifications should be presented as researched facts.
4. The backend returns one validated, structured JSON design; all tabs and generated artifacts read that contract.
5. The parts view lists exact names, specifications, and search/source links; it never scrapes live prices.
6. Custom parts are generated as CadQuery source and compiled to STL with at most three AI repair attempts. The viewer can show individual parts and the assembly.
7. The manual has numbered, explanatory steps with parts, tools, action, reason, and common mistakes. PDF export and individual step renders are lowest priority.
8. Deterministic checks report power, battery runtime, weight, fit, and simple strength only when inputs support them; assumptions and unknowns are visible.
9. A project-specific MuJoCo model/test runs through browser WASM where practical. Any success estimate must show confidence and reasons and must not imply physical validation.

## Constraints and safety

- Next.js on Vercel; Python FastAPI on Render; OpenAI API for every AI feature; use a strong design model and a cheaper small-task model, with OpenAI built-in web search for research.
- Cache repeated AI requests. There is no spend cap, account system, live-price scraping, saved-project feature, or camera build-checking.
- One in-memory browser session is sufficient; no user login or persistent project database.
- Do not hardcode product categories. Generalize through prompts, schemas, and engineering inputs.
- Do not produce actionable designs for weapons or violent attacks. Keep ordinary benign engineering requests available.
- Do not claim simulated or calculated results are certified, physically tested, or more certain than their data supports.
- Preserve the Phase 1 live deployment and update it only after local verification.
- Build order is Phases 2, 3, 4, 5. If time is short, cut PDF export first, per-step renders second, simulation third.
- Project start time in README is exactly `2026-11-14 04:51 CST`; record the end time only when all phases are actually complete.

## Data contract

The `Design` object is the sole source for downstream tabs:

```json
{
  "idea": "string",
  "summary": "string",
  "research": [{"title":"string","url":"string","snippet":"string"}],
  "components": [{"name":"string","purpose":"string","quantity":1}],
  "parts": [{"name":"string","specifications":"string","quantity":1,"search_url":"string","source_urls":["https://..."]}],
  "connections": [{"from":"string","to":"string","description":"string"}],
  "power": {"voltage":"string","current":"string","battery":"string","estimated_runtime":"string"},
  "dimensions": {"overall":"string","notes":"string"},
  "custom_parts": [{"name":"string","purpose":"string","cadquery_code":"string","dimensions":"string"}],
  "manual": [{"number":1,"title":"string","parts":["string"],"tools":["string"],"action":"string","reason":"string","mistakes":["string"]}],
  "assumptions": ["string"]
}
```

Intake is a separate response: feasibility (`feasible`, `needs_clarification`, `impossible`, `unsafe`), explanation, alternatives, four defaulted questions, and their answer values. Design requests include idea plus accepted/defaulted answers and produce this one `Design` object.

## Phase acceptance

- Phase 2: selectable/defaulted intake; infeasible alternatives; cited live research; validated design JSON; cache; frontend progress.
- Phase 3: safe bounded CadQuery compilation and retry limit; STL viewer; source-based parts; explanatory manual; PDF is optional and may be omitted.
- Phase 4: code-based engineering checks with explicit unknowns; browser MuJoCo WASM test and transparent score, unless time forces it to be cut after PDF/per-step renders.
- Phase 5: exercise prompts covering drone, headphones, blood pressure monitor, robotic arm, and impossible idea; polish errors/loading; README with deployed status and finish timestamp.

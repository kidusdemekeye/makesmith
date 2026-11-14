# CAD Geometry Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Makesmith from presenting a compilable but description-mismatched primitive mesh as the requested custom part.

**Architecture:** Before STL compilation, have the configured small OpenAI model compare each custom part's name, purpose, dimensions, and CadQuery source. Send mismatches through the existing bounded repair loop and fail closed after three attempts. Keep the check category-agnostic so it works for arbitrary hardware ideas.

**Tech Stack:** Python FastAPI backend, OpenAI Responses API, CadQuery, unittest.

**Spec:** Original Makesmith request: custom parts use CadQuery compiled to STL; failed output is sent to AI for repair up to three tries; the app remains general with no hardcoded hardware categories.

## Global Constraints

- Use OpenAI for all AI features and use the small model for small tasks.
- Cache AI responses where applicable.
- Keep CAD execution sandboxed and bounded.
- Do not hardcode hardware categories.
- Do not label an unverified export as a matching printable part.

## Review Focus

- A simple solid primitive that conflicts with its stated purpose must be rejected or repaired.
- A correct simple primitive must remain allowed when its description matches.
- Mismatches persisting through three attempts must fail without returning an STL.
- A verifier API failure must fail closed without exposing secrets.
- Multiple parts must be checked independently while preserving assembly transforms.

### Task 1: Verify CAD geometry against its description

**Files:**
- Modify: `apps/api/app/cad.py`
- Test: `apps/api/tests/test_cad.py`

**Interfaces:**
- Consumes: each custom part's `name`, `purpose`, optional `dimensions`, and `cadquery_code`.
- Produces: `CadService(..., verifier=None)` where `verifier(part, source)` returns `(matches_description: bool, issue: str)`; default verifier uses the configured OpenAI small model.

- [ ] Write tests that: a mismatched shape is repaired before compilation; a persistent mismatch fails after three tries without returning STL; a matching simple part still compiles; verifier failure fails closed.
- [ ] Run those tests and confirm they fail against current code.
- [ ] Implement a category-agnostic geometry review using the existing OpenAI small model and strict structured output.
- [ ] Feed a mismatch reason plus the part description into the existing three-attempt CAD repair flow; compile only after verification.
- [ ] Run the full API suite and inspect the diff for unsafe CAD behavior or leaked API errors.
- [ ] Commit the verified change.

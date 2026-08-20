---
name: contract-writing
description: How to write sdlc contract files (contract/tests.md and contract/evals.md) — the tests-and-evals-before-code contract. Load when creating or reviewing a change's contract.
user-invocable: false
---
# Writing the contract (tests + evals before code)

## contract/tests.md (≤60 lines) — the deterministic half
- One table row per behavior: `| # | Given/When/Then | kind | requirement |`.
- Derive rows FROM the Delta scenarios; every ADDED/MODIFIED requirement must
  appear in at least one row. Uncovered requirement = contract gap.
- Prefer the cheapest kind that proves the behavior (unit > int > e2e).
- `## Out of scope` names what is deliberately untested and why — silence is not
  a decision.
- Generated tests must FAIL before implementation (red). A pre-passing test
  tests nothing.

## contract/evals.md (≤40 lines) — the non-deterministic half (deep tier)
- Trajectory lines: did the agent read the contract first, run tests before
  claiming done, stay inside its file scope?
- Quality lines: change-specific bars a human reviewer would check.
- A written pass bar (e.g. "all ≥4") — the sdlc-evaluator scores 1–5 per line
  and failures route back to build with a cluster note.

Anti-patterns: restating the delta as prose, rows nobody can automate,
rubric lines that cannot be scored from the diff + task log.

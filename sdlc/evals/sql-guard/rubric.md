# Eval contract — sql-guard-string-literals
<!-- cap:40 · deep tier. Scored against the diff + task log. -->

## Rubric (score 1–5 each)
- Trajectory: failing tests existed and were RED before implementation; contract read before code.
- Scope: diff touches only src/services/db.ts, tests/, package.json test script — nothing else.
- Fail-closed: every ambiguous parse path in the new code classifies as NOT read-only.
- No weakening: all pre-existing rejection behavior still rejected (rows 5–9).

## Pass bar
- all scores ≥ 4 · failures route back to /sdlc:build with a cluster note

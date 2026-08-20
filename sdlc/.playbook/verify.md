# /sdlc:verify <id> — the feedback loop

Two halves, both must pass. Verification is against the CONTRACT, not vibes.

1. **Tests (deterministic)**: run the full test command from `sdlc/harness.md`.
   Every row of `contract/tests.md` must be covered by a passing test.
2. **Evals (non-deterministic)** — when `contract/evals.md` exists: delegate to
   the `sdlc-evaluator` agent (cheap) with the rubric + the diff + the task log;
   it returns a score per rubric line. Pass bar is written in the file.

On failure:
- Cluster failures by root cause (one line each) and append the cluster note to
  the change's `## Tasks` area as unchecked fix tasks.
- `node sdlc/.hooks/journal.mjs note verify result=fail round=<n>`
- Route back to /sdlc:build. Maximum 3 rounds total; on the 4th failure STOP and
  escalate to the human with the cluster history (Autonomy policy condition).
- Never lower the bar: do not edit tests/evals to pass unless the contract
  itself was wrong — changing the contract reopens the adversarial check.

On pass: set `status: verified`,
`node sdlc/.hooks/journal.mjs note verify result=pass round=<n>`.

Next: review signals present (deep tier, security-touching diff, >10 files)
→ /sdlc:review; otherwise → /sdlc:ship.

# /sdlc:contract <id> — tests + evals before code

The contract IS the handshake. Nothing in `## Tasks` may be implemented while
status is `new`.

1. From the Delta scenarios, write `contract/tests.md` (≤60 lines): one row per
   behavior — Given/When/Then, kind, mapped requirement. List what is explicitly
   out of scope and why.
2. Deep tier (standard optional): write `contract/evals.md` (≤40 lines) — the
   trajectory + quality rubric the sdlc-evaluator will score.
3. Generate failing tests: delegate to the `sdlc-contractor` agent (cheap tier)
   with ONLY tests.md + the delta + the project's test conventions. Run the test
   command from `sdlc/harness.md` — every new test must FAIL (red) now; a test
   that passes before implementation tests nothing.
4. Adversarial check instead of human approval: ask the `sdlc-quality` agent to
   attack the contract — uncovered scenarios, untestable rows, missing edge
   cases vs the delta. Fix findings; one round is usually enough, two max.
5. `npx @warnyin/sdlc validate <id>` clean → set frontmatter `status: contracted`
   and `node sdlc/.hooks/journal.mjs note contract tests=<n>`.

Escalate only if the delta itself turns out ambiguous (back to /sdlc:new step 5).

Next: /sdlc:build.

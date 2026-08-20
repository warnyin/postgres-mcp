# /sdlc:ship <id> — merge, archive, learn, digest

Precondition: `status: verified` (+ review passed when it ran).

1. **Policy check** (`sdlc/harness.md § Autonomy policy`): if this change is NOT
   auto-shippable (deep/hard-floor), show the human a 5-line summary (why, delta
   heads, verify result, cost so far) and wait for approval. Otherwise proceed.
2. Open the gate and archive mechanically:
   `node sdlc/.hooks/journal.mjs open-ship <id>`
   `npx @warnyin/sdlc archive <id>`
   (validates --strict, merges every Delta into `sdlc/specs/`, promotes evals,
   stamps `status: shipped`, moves the folder to `changes/archive/<date>-<id>/`).
3. **Learn** — delegate to `sdlc-learner` (cheap) with the archived change.md +
   its journal.ndjson. It proposes ≤3 items: add-rule (with evidence pointer) /
   expire-or-demote (rule or steering that never fired) / harness tweak.
   Apply reductions and demotions immediately (they always save tokens).
   Additions to always-loaded context are NOT applied — list them in the digest.
4. **Digest** — write `sdlc/changes/archive/<date>-<id>/digest.md` (≤15 lines):
   what shipped, spec deltas merged, assumptions made, verify rounds, tokens/cost
   (from journal `session` events), learner proposals awaiting the human.
5. Close the gate: `node sdlc/.hooks/journal.mjs close`. Tell the user in one
   line: shipped + where the digest is.

The digest is the async human touchpoint — reviewable and revertible later.

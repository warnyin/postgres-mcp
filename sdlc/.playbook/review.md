# /sdlc:review <id> — agent panel (signal-triggered)

Run when: tier deep, OR the diff touches auth/payments/data handling, OR >10
files changed. Otherwise skip silently — a ceremonial review is garbage.

1. Fan out in parallel, all read-only, each with the diff + change.md only:
   - `sdlc-architect` (deepest): design integrity, coupling, contract drift.
   - `sdlc-security` (balanced): injection, authz, secrets, unsafe deps.
   - `sdlc-quality` (cheap): contract coverage gaps, edge cases, dead code.
   - `sdlc-ops` (cheap): config, migrations, rollback, observability impact.
2. Merge findings in the main loop. Classify: blocker | improvement | note.
3. Blockers → append as fix tasks and route back to /sdlc:build (counts toward
   the same 3-round budget as verify). Improvements: apply if ≤5 min each,
   otherwise record one line in the change for the digest.
4. `node sdlc/.hooks/journal.mjs note review blockers=<n>`.

Pass condition: zero open blockers. Next: /sdlc:ship.

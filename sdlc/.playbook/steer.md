# /sdlc:steer — manage the static/dynamic boundary

The ONLY sanctioned way to edit always-loaded context.

1. `node sdlc/.hooks/journal.mjs open-steer`
2. Apply the requested edits:
   - New knowledge → a steering file with the LEAST resident inclusion mode that
     works: `agent` > `manual` > `paths` > `always` (always needs justification).
   - Constitution edits: SHALL/SHALL NOT lines only. If the always-budget
     (60 lines) would overflow, something must be demoted or deleted first —
     name the displaced line explicitly.
3. Hygiene pass (do it every time, it is 30 seconds):
   - `/sdlc:observe` data — steering never pointer-hit across the last N changes
     → propose demote (`paths`→`manual`) or delete.
   - Rules with no guard/journal evidence of ever mattering → propose expiry.
   - Apply what the user agrees to (reductions may be applied without asking).
4. `npx @warnyin/sdlc validate` — the always-budget check must be green.
5. `node sdlc/.hooks/journal.mjs close`

Learning direction is one-way by design: content flows from always → paths →
manual → deleted as evidence accumulates. Getting leaner is the success metric.

# /sdlc:next — where am I, what now (read-only)

1. Run `npx @warnyin/sdlc status`.
2. For each active change map status → next command:
   - `new` + markers unresolved → resolve questions (playbook new.md §5)
   - `new` (clean) → /sdlc:design (deep/signal) or /sdlc:contract
   - `contracted` → /sdlc:build
   - `building` → /sdlc:build (finish open tasks)
   - `verified` → /sdlc:review (if signals) or /sdlc:ship
3. If nothing is active: suggest /sdlc:new, or /sdlc:observe if archived changes
   have unread digests.
4. Answer in ≤5 lines. Create or modify nothing.

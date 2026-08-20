# /sdlc:design <id> — decisions & trade-offs (deep tier, or on signal)

Run only when: tier is deep, OR the change needs an architectural decision
(new dependency, schema change, cross-capability contract). Otherwise skip —
an empty Design section is garbage.

1. Read `change.md`, the full spec of every touched capability, and any steering
   whose scope matches. Nothing else by default.
2. Gather in parallel, judge serially: fan out read-only subagents for research
   (one per question: prior art in this repo, external constraint, data shape).
   The DECISION is made in the main loop — never delegated, never parallel.
3. Fill `## Design` with decision lines only:
   `- decision: <what> · alternatives: <a/b> · because: <why>`
   Never restate the delta. Respect the tier cap (deep total ≤150).
4. Escalate to the human ONLY for decisions listed in
   `sdlc/harness.md § Autonomy policy` (irreversible or hard-floor). Everything
   else: decide, record, move on.
5. `npx @warnyin/sdlc validate <id>`.

Next: /sdlc:contract.

# /sdlc:observe — cost, flow, and drift report

1. Run `npx @warnyin/sdlc observe --json` and render it for the human. Do not
   recompute anything the CLI already computed.
2. Report, in this order (skip empty sections):
   - **Pending digests** — archived changes whose digest the human has not been
     shown yet (learner proposals awaiting a decision).
   - **Cost** — tokens/cost per active + recent change; retry waste (tokens spent
     after the first verify fail).
   - **Flow** — lead time per shipped change and per-phase breakdown (created →
     contracted → built → verified → shipped timestamps from the journal);
     AI-time vs wait-time; first-pass success trend.
   - **Residency** — always-loaded lines vs the 60 budget.
   - **Drift flags** — steering never hit by a pointer, rules never triggering a
     guard event, `compact` events (context overflow = a defect), specs touched
     by many changes (converge candidates).
3. For each flag, offer the one-line fix (`/sdlc:steer` demotion, `/sdlc:converge`
   on a capability, cap adjustment) — recommend, never auto-apply here.

Read-only: this command changes nothing.

# Model routing

Generic tiers only — the harness adapter maps them to real models
(Claude Code agents: cheap→haiku, balanced→sonnet, deepest→opus).

| Task kind | Tier | Why |
|---|---|---|
| requirements shaping, architecture, deep design | deepest | judgment-heavy, small volume |
| standard implementation (sdlc-builder) | balanced | quality/cost sweet spot |
| test generation (sdlc-contractor) | cheap | mechanical from the contract table |
| eval judging (sdlc-evaluator) | cheap | rubric scoring, high volume |
| review panel passes | cheap–balanced | parallel, bounded scope |
| learning distillation (sdlc-learner) | cheap | summarization over journals |

Rules:
- Task lines in change.md may carry `[tier:cheap|balanced|deepest]`; default = balanced.
- Never send a mechanical task to deepest "to be safe" — that is the waste the
  routing table exists to prevent.
- Escalate one tier only after a concrete failure at the current tier (journal it).

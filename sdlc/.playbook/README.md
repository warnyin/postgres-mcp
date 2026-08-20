# @warnyin/sdlc playbook

One change = one folder in `sdlc/changes/<id>/` moving through:

```
new → [design] → contract → build → verify → [review] → ship
```

| Command | Day-1 phase | Reads | Writes | Gate (automatic unless noted) |
|---|---|---|---|---|
| /sdlc:init | Configure harness | interview | constitution, harness.md | human approves (once) |
| /sdlc:auto | whole loop | — | everything below | escalation only |
| /sdlc:new | Requirements | specs Purpose headers | change.md | validator: delta + assumptions |
| /sdlc:design | Architecture | change + touched specs | change.md § Design | escalate irreversible only |
| /sdlc:contract | Contract-first | change.md | contract/*, failing tests | adversarial panel + validator |
| /sdlc:build | Run harness | change + contract + steering | code, task boxes | tasks done; specs locked by hook |
| /sdlc:verify | Feedback loop | contract | journal events | tests green AND evals ≥ bar |
| /sdlc:review | Review | diff + change | findings in change.md | blockers = 0 |
| /sdlc:ship | Ship | change | specs merge, archive, digest | validate --strict; policy may require human |
| /sdlc:observe | Observe | journals | report (chat) | — |
| /sdlc:converge | Maintenance | specs + code | proposed change | — |
| /sdlc:steer | Configure | context/ | steering, constitution | always-budget ≤ 60 |
| /sdlc:next | — | status | chat only | — |

Statuses: `new → contracted → building → verified → shipped`. Tiers: `vibe | standard | deep`
(triage table + Autonomy policy live in `sdlc/harness.md`).

Doctrine: `principles.md` (factory model, anti-garbage), `context.md` (static/dynamic),
`routing.md` (model tiers). Non-Claude harnesses: `rules-card.md` is embedded in your
tool's rules file; `npx @warnyin/sdlc validate` is the enforcement floor.

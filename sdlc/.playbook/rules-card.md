# sdlc rules card
<!-- ≤40 lines · embedded verbatim in non-Claude tool adapters; Claude gets the same rules enforced by hooks. -->

- Work flows through `sdlc/changes/<id>/change.md`: new → [design] → contract → build → verify → [review] → ship.
- NEVER edit `sdlc/specs/**` or `sdlc/changes/archive/**` by hand. Living specs change only
  via a change's `## Delta:` section, merged by `npx @warnyin/sdlc archive <id>` at ship.
- NEVER hand-edit `journal.ndjson` or `sdlc/.state/**` — they are machine-owned.
- Write tests + evals (`contract/`) BEFORE code. No implementation while status is `new`.
- Ambiguity: make the safest assumption and record it under `## Assumptions`; use
  `[NEEDS CLARIFICATION: q]` only for facts you cannot obtain — resolve all before contract.
- Respect line caps written in each template comment; run `npx @warnyin/sdlc validate <id>`
  before claiming any gate passed — a red validator means the gate did NOT pass.
- Constitution edits go through /sdlc:steer only; always-loaded context ≤ 60 lines total.
- Verify = real test run + eval rubric. Max 3 fix rounds, then escalate to the human.
- Hard-floor (security, payments, data-loss, irreversible): tier = deep, human approves ship.
- Before editing an area, read any steering file whose `pathMatch` covers it.

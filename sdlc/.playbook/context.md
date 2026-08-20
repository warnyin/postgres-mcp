# Context engineering

Six context types: instructions, knowledge, memory, examples, tools, guardrails.
The design decision is WHERE each lives: static (always loaded, expensive) vs
dynamic (loaded on demand, cheap). That boundary is versioned code, reviewed in PRs.

## Static (injected every session by the SessionStart hook, hard cap 60 lines total)
- `sdlc/context/constitution.md` (≤30) — hard rules + stack facts only.
- `sdlc/context/steering/*.md` with `inclusion: always` — should be rare.
- One pointer line to the active change.

## Dynamic (loaded only when needed)
- `inclusion: paths` steering — the PostToolUse hook emits a POINTER when an edited
  file matches `pathMatch`; you then read the file. Pointers cost ~1 line, not 40.
- `inclusion: manual` — read only when a playbook or user names it.
- `inclusion: agent` — subagents load it themselves; the main loop never pays for it.
- Living specs — read the `## Purpose` header first; open the full spec only for
  capabilities your change touches.
- Playbooks — each command reads exactly one playbook file.

## Budget rules
- Always-budget (constitution + always-steering) ≤ 60 lines. Validator-enforced.
- Adding an always rule requires removing one, or demoting something to `paths`.
- `/sdlc:observe` reports steering that never fires — expire or demote it.
- A `compact` event in the journal means context overflowed: treat as a defect,
  find the resident artifact that caused it.

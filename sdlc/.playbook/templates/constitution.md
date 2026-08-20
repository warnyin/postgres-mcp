# Constitution — <project>
<!-- cap:30 · ALWAYS LOADED: every line here costs tokens in EVERY turn. Prove residency or move it to steering. -->

## Stack (facts only, max 3 lines)
- <runtime / framework / db — one line each>

## Hard rules (SHALL / SHALL NOT only — no advice)
- The agent SHALL NOT edit `sdlc/specs/**` or `sdlc/changes/archive/**` outside `/sdlc:ship`.
- The agent SHALL record every assumption in the change's `## Assumptions` before acting on it.
- <add a rule each time the agent misbehaves; each new rule must displace an old one once the always-budget (60 lines) is full>

## Workflow
- Changes flow: new → [design] → contract → build → verify → [review] → ship.
- Tier by stakes: vibe | standard | deep — triage table lives in `sdlc/harness.md`.

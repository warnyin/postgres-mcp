# /sdlc:build <id> — implement (Run the harness)

Precondition: status ≥ contracted (vibe tier is exempt from contracts).
Set `status: building`.

Mode by size:
- **Conductor** (≤2 tasks): implement in this session, task by task.
- **Orchestrator** (>2 tasks): fan out one `sdlc-builder` subagent per task in a
  `[P]` wave; serialize between dependent waves. Each builder receives ONLY:
  its task line, `contract/tests.md`, the touched capability's spec, and steering
  matching its file area — never the whole change history.

Rules for whoever implements:
- Follow steering pointers the moment the PostToolUse hook emits them.
- Never edit `sdlc/specs/**`, archive, journals, or lint/test configs to go
  green — hooks deny the first two; the rest is the config-protection rule.
- Per-task self-check = that task's tests + lint only; the full test run belongs
  to /sdlc:verify (moved, not removed).
- Tick `- [x]` in `## Tasks` as each task lands; note surprises in one line max.
- Honor `[tier:x]` markers when delegating (see routing.md).

Done when all tasks are ticked and the code compiles/lints.
`node sdlc/.hooks/journal.mjs note build tasks=<n>` then → /sdlc:verify.

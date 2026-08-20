---
name: delta-spec-format
description: Grammar for writing Delta sections in sdlc change.md files and living specs (ADDED/MODIFIED/REMOVED Requirement blocks with WHEN/THEN scenarios). Load when writing or editing any sdlc spec/delta content.
user-invocable: false
---
# Delta-spec grammar (parser keys are frozen English)

In `change.md`, one section per touched capability:

```markdown
## Delta: <capability>

### ADDED Requirement: <name>
The system SHALL <observable behavior>.

#### Scenario: <name>
- WHEN <condition or event>
- THEN <observable outcome>

### MODIFIED Requirement: <existing exact name>
<full replacement body — the whole requirement text, not a diff>

### REMOVED Requirement: <existing exact name>
```

Rules:
- The requirement heading text is the identity key — MODIFIED/REMOVED must match an
  existing name in `sdlc/specs/<capability>/spec.md` exactly (case-insensitive).
- Observable behavior only; no class/function names, no implementation.
- Every ADDED/MODIFIED requirement needs ≥1 scenario a test can be derived from.
- Placeholders only (`<token>`, `user@example.com`) — never real secrets/PII.
- `npx @warnyin/sdlc archive <id>` merges deltas mechanically at ship; a missing
  key aborts the merge — never work around it by editing specs directly.

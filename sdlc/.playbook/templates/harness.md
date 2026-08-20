# Harness — <project>
<!-- cap:60 · CONFIGURE-phase output; reviewed like code. Registry + tables only — doctrine lives in sdlc/.playbook/. -->

## Tools & MCP (what the agent may call)
| Tool/MCP | Scope | Notes |
|---|---|---|
| <tool> | <what it may touch> | <when to use> |

## Sandbox & execution
- test command: `<cmd>`
- sandbox notes: <where code runs, what it cannot reach>

## Guardrails (mirror of installed hooks — deterministic, the agent cannot skip them)
- `sdlc/specs/**` and archive are write-locked outside ship.
- Artifact line caps validated on every write.
- Session token/cost journaled per change.

## Model routing (generic tiers — the harness adapter maps them to real models)
| Task kind | Tier |
|---|---|
| requirements, architecture, deep design | deepest |
| standard implementation | balanced |
| test generation, review passes, mechanical/scaffold, eval judging, learning | cheap |

## Tier triage (stakes → tier)
- vibe: reversible, no behavior-contract change, ≤2 files.
- deep: security / payments / data-loss / irreversible surface, new capability, or multi-capability delta.
- otherwise: standard.

## Autonomy policy
- auto-ship: vibe, standard.
- escalate to human: hard-floor (security, payments, data-loss, irreversible), verify failed > 3 rounds,
  token budget exceeded, information the agent cannot obtain or safely assume.

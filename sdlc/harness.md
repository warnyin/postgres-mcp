# Harness — @warnyin/postgres-mcp
<!-- cap:60 · CONFIGURE-phase output; reviewed like code. Registry + tables only — doctrine lives in sdlc/.playbook/. -->

## Tools & MCP (what the agent may call)
| Tool/MCP | Scope | Notes |
|---|---|---|
| npm run build | tsc → dist/ | required before tests (tests import dist/) |
| node --test | tests/ | unit tests on compiled output |

## Sandbox & execution
- test command: `npm test` (= build + node --test)
- sandbox notes: unit tests must not require a live PostgreSQL; pure functions only.

## Guardrails (mirror of installed hooks — deterministic, the agent cannot skip them)
- `sdlc/specs/**` and archive are write-locked outside ship.
- Artifact line caps validated on every write.
- Session token/cost journaled per change.

## Model routing (generic tiers — the harness adapter maps them to real models)
| Task kind | Tier |
|---|---|
| requirements, architecture, deep design | deepest |
| standard implementation | balanced |
| test generation, review passes, mechanical/scaffold, eval judging | cheap |

## Tier triage (stakes → tier)
- vibe: docs/README, tool descriptions, ≤2 files, no behavior change.
- deep: anything touching `isReadOnlySql`, transaction modes, SQL execution paths,
  connection/credential handling (= security surface of this package).
- otherwise: standard.

## Autonomy policy
- auto-ship: vibe, standard.
- escalate to human: hard-floor (the deep triggers above), verify failed > 3 rounds,
  token budget exceeded, information the agent cannot obtain or safely assume.

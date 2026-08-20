# Constitution — @warnyin/postgres-mcp
<!-- cap:30 · ALWAYS LOADED: every line here costs tokens in EVERY turn. Prove residency or move it to steering. -->

## Stack (facts only, max 3 lines)
- TypeScript ESM MCP server: @modelcontextprotocol/sdk + zod + pg; build `tsc` → dist/.
- Distribution: npx bin (`postgres-mcp`); package `files` allowlist = dist only.

## Hard rules (SHALL / SHALL NOT only — no advice)
- `postgres_query` SHALL remain read-only: never weaken `isReadOnlySql` or the READ ONLY transaction; ambiguity SHALL classify as NOT read-only (fail closed).
- The agent SHALL NOT add runtime dependencies.
- SQL examples/docs SHALL use $1 placeholders — never string concatenation.
- The agent SHALL NOT edit `sdlc/specs/**` or `sdlc/changes/archive/**` outside `/sdlc:ship`.
- The agent SHALL record every assumption in the change's `## Assumptions` before acting on it.

## Workflow
- Changes flow: new → [design] → contract → build → verify → [review] → ship.
- Tier by stakes: vibe | standard | deep — triage table lives in `sdlc/harness.md`.

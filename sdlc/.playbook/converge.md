# /sdlc:converge [capability] — spec ↔ code drift (Maintenance)

Living specs are only useful while they are true. Converge closes the gap.

1. Scope: the named capability, or the ones `/sdlc:observe` flagged.
2. For each requirement in `sdlc/specs/<capability>/spec.md`, check the code
   actually behaves that way (read the relevant code; run targeted tests where
   cheap). Three outcomes per requirement:
   - **true** — nothing to do.
   - **code drifted** — behavior no longer matches the spec.
   - **spec stale** — the spec describes behavior nobody wants anymore.
3. Report the diff table in chat (requirement · outcome · evidence file:line).
4. For every drift/stale finding the user wants fixed, open ONE change via
   /sdlc:new whose Delta uses MODIFIED/REMOVED against the exact requirement
   names — converge itself NEVER edits specs or code directly.
5. If a recent rule/playbook edit correlates with worse flywheel metrics
   (observe shows it), propose the revert here as a change too.

Read-only except for creating proposed change folders.

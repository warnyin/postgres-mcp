# /sdlc:init — configure the harness (run once per project)

The only planned blocking human gate in the framework: the human approves the
policy the AI will then drive under.

1. Read `sdlc/config.yaml`, the repo README, manifest files (package.json etc.),
   and skim the top-level structure. Do NOT deep-read the codebase.
2. Interview the user briefly (≤6 questions): what the project is, hard rules the
   agent must never break, test command, risk areas (security/payments/data-loss),
   and how autonomous shipping should be (adjusts `## Autonomy policy`).
3. Open the gate: `node sdlc/.hooks/journal.mjs open-steer`, then write:
   - `sdlc/context/constitution.md` — replace template placeholders; ≤30 lines;
     SHALL/SHALL NOT rules only, stack facts ≤3 lines.
   - `sdlc/harness.md` — fill tools, test command, sandbox notes; adjust the
     routing, triage, and Autonomy policy tables to this project.
   - 0–3 steering seeds in `sdlc/context/steering/` for areas with real
     conventions (prefer `inclusion: paths`; `always` needs strong justification).
4. Run `npx @warnyin/sdlc validate` — fix every error.
5. Show the user constitution + harness verbatim; iterate until approved.
6. Close the gate: `node sdlc/.hooks/journal.mjs close`.

Output: approved constitution + harness. No change folder is created here.

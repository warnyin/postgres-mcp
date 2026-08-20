# /sdlc:new <title> — open a change (Requirements)

1. Triage the tier with `sdlc/harness.md § Tier triage`. Hard-floor surface
   (security, payments, data-loss, irreversible) forces `deep` — no override
   without an explicit user instruction (record it in Assumptions).
2. Create `sdlc/changes/<kebab-id>/change.md` from the tier's template at
   `sdlc/.playbook/templates/change-{vibe|standard|deep}.md` — copy the
   structure exactly, respect the cap comment.
3. Ground the delta: grep `## Purpose` of every `sdlc/specs/*/spec.md`; open the
   FULL spec only for capabilities this change touches. Name each `## Delta:`
   after an existing capability, or a new kebab-case capability.
4. Write Why (≤5 lines, no solutioning) and the Delta requirements
   (`ADDED/MODIFIED/REMOVED Requirement` + WHEN/THEN scenarios — grammar in the
   delta-spec-format skill). Then Tasks with `[P]` and `[tier:x]` markers.
5. Ambiguity policy (AI-driven): make the safest assumption and record it under
   `## Assumptions` with why it is safe. Use `[NEEDS CLARIFICATION: q]` ONLY for
   facts you cannot obtain or safely assume — then ask the user those questions
   now, in one batch, and resolve every marker.
6. `node sdlc/.hooks/journal.mjs set-active <id>` then
   `npx @warnyin/sdlc validate <id>` — fix errors. Status stays `new`.

Next: deep tier or risky decision → /sdlc:design; otherwise /sdlc:contract.

# Principles

## Factory model
Your output is the system that produces code — specs, contracts, gates, feedback loops,
guardrails — not the code itself. Give agents success criteria, not step-by-step
instructions, then let them iterate. Humans set policy once (`/sdlc:init`) and read
ship digests asynchronously; they are interrupted only by policy-listed exceptions.

## Economics (CapEx / OpEx)
Configuration (constitution, harness, steering, contracts) is CapEx: paid once, reviewed
like code. Every resident line of context is OpEx paid in every turn. Therefore:
- Every mandatory artifact has a stated reason and a line cap (see template comments).
- No artifact may restate another; deltas are merged mechanically, never re-narrated.
- Retry loops are the expensive failure mode — contracts up front buy first-pass success.

## Anti-garbage rules
- Optional artifacts (design section, evals for standard tier) exist only on signal.
- If a section would be empty, delete the section — never keep placeholder prose.
- The learner may only ADD an always-loaded rule by displacing an old one (fixed budget).
- Machine data (journals, state, learning stats) never lives in prose files.

## Verification stance
Tests verify the deterministic; evals verify trajectory and quality. Both are written
before code — together they are the contract with the AI. "Seems to work" is not a gate.

## Minimalism
Prefer: do nothing → stdlib → existing dependency → smallest new code. Never cut:
trust-boundary validation, data-loss handling, security controls, the contract itself.

// Canonical line-cap table — the single source of truth for artifact
// residency budgets. Templates quote these numbers in HTML comments and
// tests/caps-sync.test.mjs asserts both stay identical.
//
// Rationale (Day-1 economics): every resident line is paid for in every
// turn. Caps make "learning = distilling" structural, not disciplinary.

import { parseFrontmatter } from './frontmatter.mjs';

export const CAPS = Object.freeze({
  constitution: 30,     // sdlc/context/constitution.md — always loaded
  steeringFile: 40,     // each sdlc/context/steering/*.md
  alwaysBudget: 60,     // constitution + all `inclusion: always` steering, combined
  harness: 60,          // sdlc/harness.md
  spec: 150,            // sdlc/specs/<capability>/spec.md (soft — split capability beyond)
  change: Object.freeze({ vibe: 40, standard: 100, deep: 150 }),
  contractTests: 60,    // changes/<id>/contract/tests.md
  contractEvals: 40,    // changes/<id>/contract/evals.md
});

export const TIERS = Object.freeze(['vibe', 'standard', 'deep']);

export const STATUSES = Object.freeze([
  'new', 'contracted', 'building', 'verified', 'shipped',
]);

// Effective lines = body lines after frontmatter, excluding blanks and
// single-line HTML comments. Caps meter prose the model must carry, not
// machine metadata or annotation comments.
export function countEffectiveLines(text) {
  const { body } = parseFrontmatter(text ?? '');
  return body
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (t === '') return false;
      if (t.startsWith('<!--') && t.endsWith('-->')) return false;
      return true;
    })
    .length;
}

export function capForChange(tier) {
  return CAPS.change[tier] ?? CAPS.change.standard;
}

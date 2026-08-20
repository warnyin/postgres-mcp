// Structural validator — the tool-agnostic enforcement floor.
// Used by: CLI (`warnyin-sdlc validate`), CI, and the PostToolUse hook.
// Exit codes: 0 = clean (warnings allowed), 1 = errors found, 2 = usage/setup error.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { CAPS, TIERS, STATUSES, countEffectiveLines, capForChange } from './caps.mjs';
import { parseDelta, parseSpec } from './delta.mjs';

const CLARIFICATION_RE = /\[NEEDS CLARIFICATION/g;

export function statusRank(status) {
  const i = STATUSES.indexOf(status);
  return i === -1 ? 0 : i;
}

function issue(level, where, msg) {
  return { level, where, msg };
}

// ---------- change validation ----------

export function validateChange(changeDir, { strict = false, specsDir = null } = {}) {
  const issues = [];
  const id = path.basename(changeDir);
  const changePath = path.join(changeDir, 'change.md');
  if (!fs.existsSync(changePath)) {
    return [issue('error', id, 'change.md is missing')];
  }
  const text = fs.readFileSync(changePath, 'utf8');
  const { data } = parseFrontmatter(text);

  if (!data.id) issues.push(issue('error', id, 'frontmatter: missing id'));
  else if (data.id !== id) issues.push(issue('error', id, `frontmatter id "${data.id}" != folder name "${id}"`));
  if (!TIERS.includes(data.tier)) issues.push(issue('error', id, `frontmatter: tier must be one of ${TIERS.join('|')}`));
  if (!STATUSES.includes(data.status)) issues.push(issue('error', id, `frontmatter: status must be one of ${STATUSES.join('|')}`));

  const tier = TIERS.includes(data.tier) ? data.tier : 'standard';
  const status = STATUSES.includes(data.status) ? data.status : 'new';

  const lines = countEffectiveLines(text);
  const cap = capForChange(tier);
  if (lines > cap) issues.push(issue('error', id, `change.md is ${lines} effective lines (cap for ${tier}: ${cap})`));

  const markers = (text.match(CLARIFICATION_RE) ?? []).length;
  if (markers > 0) {
    const level = strict || status !== 'new' ? 'error' : 'warn';
    issues.push(issue(level, id, `${markers} unresolved [NEEDS CLARIFICATION] marker(s)`));
  }

  const { deltas, errors: deltaErrors } = parseDelta(text);
  for (const e of deltaErrors) issues.push(issue('error', id, `delta: ${e}`));
  if (tier !== 'vibe' && deltas.length === 0) {
    issues.push(issue('warn', id, 'no ## Delta section — spec-driven changes should state their behavior delta'));
  }

  // MODIFIED/REMOVED must target requirements that exist in living specs.
  if (specsDir) {
    for (const d of deltas) {
      const specPath = path.join(specsDir, d.capability, 'spec.md');
      const spec = fs.existsSync(specPath) ? parseSpec(fs.readFileSync(specPath, 'utf8')) : null;
      const names = new Set((spec?.requirements ?? []).map((r) => r.name.toLowerCase()));
      for (const op of d.ops) {
        if ((op.op === 'MODIFIED' || op.op === 'REMOVED') && !names.has(op.name.toLowerCase())) {
          issues.push(issue(strict ? 'error' : 'warn', id,
            `${op.op} Requirement "${op.name}" not found in specs/${d.capability}/spec.md`));
        }
      }
    }
  }

  // Contract requirements by status/tier.
  const testsPath = path.join(changeDir, 'contract', 'tests.md');
  const evalsPath = path.join(changeDir, 'contract', 'evals.md');
  if (tier !== 'vibe' && statusRank(status) >= statusRank('contracted') && !fs.existsSync(testsPath)) {
    issues.push(issue('error', id, `status "${status}" requires contract/tests.md`));
  }
  if (tier === 'deep' && statusRank(status) >= statusRank('contracted') && !fs.existsSync(evalsPath)) {
    issues.push(issue('error', id, 'deep tier requires contract/evals.md'));
  }
  if (fs.existsSync(testsPath)) {
    const n = countEffectiveLines(fs.readFileSync(testsPath, 'utf8'));
    if (n > CAPS.contractTests) issues.push(issue('error', id, `contract/tests.md is ${n} lines (cap ${CAPS.contractTests})`));
  }
  if (fs.existsSync(evalsPath)) {
    const n = countEffectiveLines(fs.readFileSync(evalsPath, 'utf8'));
    if (n > CAPS.contractEvals) issues.push(issue('error', id, `contract/evals.md is ${n} lines (cap ${CAPS.contractEvals})`));
  }

  return issues;
}

// ---------- context / harness validation ----------

export function validateContext(sdlcRoot) {
  const issues = [];
  const constitutionPath = path.join(sdlcRoot, 'context', 'constitution.md');
  let alwaysLines = 0;

  if (fs.existsSync(constitutionPath)) {
    const n = countEffectiveLines(fs.readFileSync(constitutionPath, 'utf8'));
    alwaysLines += n;
    if (n > CAPS.constitution) {
      issues.push(issue('error', 'context', `constitution.md is ${n} lines (cap ${CAPS.constitution})`));
    }
  } else {
    issues.push(issue('warn', 'context', 'constitution.md is missing (run /sdlc:init)'));
  }

  const steeringDir = path.join(sdlcRoot, 'context', 'steering');
  if (fs.existsSync(steeringDir)) {
    for (const f of fs.readdirSync(steeringDir).filter((f) => f.endsWith('.md')).sort()) {
      const raw = fs.readFileSync(path.join(steeringDir, f), 'utf8');
      const { data } = parseFrontmatter(raw);
      const n = countEffectiveLines(raw);
      if (n > CAPS.steeringFile) {
        issues.push(issue('error', `steering/${f}`, `${n} lines (cap ${CAPS.steeringFile})`));
      }
      const mode = data.inclusion ?? 'manual';
      if (!['always', 'paths', 'manual', 'agent'].includes(mode)) {
        issues.push(issue('error', `steering/${f}`, `inclusion "${mode}" must be always|paths|manual|agent`));
      }
      if (mode === 'paths' && !Array.isArray(data.pathMatch)) {
        issues.push(issue('error', `steering/${f}`, 'inclusion: paths requires pathMatch: ["glob", ...]'));
      }
      if (mode === 'always') alwaysLines += n;
    }
  }

  if (alwaysLines > CAPS.alwaysBudget) {
    issues.push(issue('error', 'context',
      `always-loaded budget is ${alwaysLines} lines (cap ${CAPS.alwaysBudget}) — demote steering or distill the constitution`));
  }

  const harnessPath = path.join(sdlcRoot, 'harness.md');
  if (fs.existsSync(harnessPath)) {
    const n = countEffectiveLines(fs.readFileSync(harnessPath, 'utf8'));
    if (n > CAPS.harness) issues.push(issue('error', 'harness', `harness.md is ${n} lines (cap ${CAPS.harness})`));
  }

  const specsDir = path.join(sdlcRoot, 'specs');
  if (fs.existsSync(specsDir)) {
    for (const cap of fs.readdirSync(specsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const specPath = path.join(specsDir, cap.name, 'spec.md');
      if (!fs.existsSync(specPath)) continue;
      const n = countEffectiveLines(fs.readFileSync(specPath, 'utf8'));
      if (n > CAPS.spec) {
        issues.push(issue('warn', `specs/${cap.name}`, `spec.md is ${n} lines (soft cap ${CAPS.spec}) — consider splitting the capability`));
      }
    }
  }

  return issues;
}

export function listChangeDirs(sdlcRoot) {
  const changesDir = path.join(sdlcRoot, 'changes');
  if (!fs.existsSync(changesDir)) return [];
  return fs.readdirSync(changesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'archive')
    .map((d) => path.join(changesDir, d.name))
    .sort();
}

export function validateAll(sdlcRoot, { strict = false, changeId = null } = {}) {
  const specsDir = path.join(sdlcRoot, 'specs');
  const issues = [...validateContext(sdlcRoot)];
  const dirs = changeId
    ? [path.join(sdlcRoot, 'changes', changeId)]
    : listChangeDirs(sdlcRoot);
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      issues.push(issue('error', path.basename(dir), 'change folder not found'));
      continue;
    }
    issues.push(...validateChange(dir, { strict, specsDir }));
  }
  return issues;
}

export function formatIssues(issues) {
  return issues
    .map((i) => `${i.level === 'error' ? '✖' : '⚠'} [${i.where}] ${i.msg}`)
    .join('\n');
}

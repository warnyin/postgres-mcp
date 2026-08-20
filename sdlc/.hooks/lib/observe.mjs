// Observability aggregation — reads journals + context files, computes the
// numbers /sdlc:observe reports. Pure given an sdlc root; no LLM involved.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { CAPS, countEffectiveLines } from './caps.mjs';

function readJournal(dir) {
  const p = path.join(dir, 'journal.ndjson');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function summarizeChange(dir, id, archived) {
  const events = readJournal(dir);
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let costUsd = 0;
  let costKnown = false;
  let sessions = 0;
  const verify = { rounds: 0, firstPass: null };
  let guards = 0;
  let compacts = 0;

  for (const e of events) {
    if (e.event === 'session') {
      sessions++;
      for (const k of Object.keys(tokens)) tokens[k] += e.totals?.[k] ?? 0;
      if (typeof e.costUsd === 'number') { costUsd += e.costUsd; costKnown = true; }
    } else if (e.event === 'verify') {
      verify.rounds++;
      if (verify.firstPass === null) verify.firstPass = e.result === 'pass';
    } else if (e.event === 'guard') guards++;
    else if (e.event === 'compact') compacts++;
  }

  const first = events[0]?.ts ? Date.parse(events[0].ts) : null;
  const shipEvent = events.find((e) => e.event === 'ship');
  const shippedAt = shipEvent?.ts ? Date.parse(shipEvent.ts) : null;
  const leadTimeMs = first != null && shippedAt != null ? shippedAt - first : null;

  let tier = null;
  let status = null;
  const changePath = path.join(dir, 'change.md');
  if (fs.existsSync(changePath)) {
    const { data } = parseFrontmatter(fs.readFileSync(changePath, 'utf8'));
    tier = data.tier ?? null;
    status = data.status ?? null;
  }

  return {
    id, archived, tier, status, sessions, tokens,
    costUsd: costKnown ? Number(costUsd.toFixed(4)) : null,
    verify, guards, compacts, leadTimeMs,
    digest: archived ? fs.existsSync(path.join(dir, 'digest.md')) : null,
  };
}

export function buildReport(sdlcRoot) {
  const changes = [];

  const changesDir = path.join(sdlcRoot, 'changes');
  if (fs.existsSync(changesDir)) {
    for (const d of fs.readdirSync(changesDir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name === 'archive') continue;
      changes.push(summarizeChange(path.join(changesDir, d.name), d.name, false));
    }
    const archiveDir = path.join(changesDir, 'archive');
    if (fs.existsSync(archiveDir)) {
      for (const d of fs.readdirSync(archiveDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        changes.push(summarizeChange(path.join(archiveDir, d.name), d.name, true));
      }
    }
  }

  // Residency: constitution + always-steering effective lines vs budget.
  let alwaysLines = 0;
  const constitutionPath = path.join(sdlcRoot, 'context', 'constitution.md');
  if (fs.existsSync(constitutionPath)) {
    alwaysLines += countEffectiveLines(fs.readFileSync(constitutionPath, 'utf8'));
  }
  const steering = [];
  const pointerHits = new Map();
  for (const c of changes) {
    const dir = c.archived
      ? path.join(sdlcRoot, 'changes', 'archive', c.id)
      : path.join(sdlcRoot, 'changes', c.id);
    for (const e of readJournal(dir)) {
      if (e.event === 'pointer' && e.steering) {
        pointerHits.set(e.steering, (pointerHits.get(e.steering) ?? 0) + 1);
      }
    }
  }
  // Global journal (events with no active change) counts too.
  for (const e of readJournal(path.join(sdlcRoot, '.state'))) {
    if (e.event === 'pointer' && e.steering) {
      pointerHits.set(e.steering, (pointerHits.get(e.steering) ?? 0) + 1);
    }
  }

  const steeringDir = path.join(sdlcRoot, 'context', 'steering');
  if (fs.existsSync(steeringDir)) {
    for (const f of fs.readdirSync(steeringDir).filter((n) => n.endsWith('.md')).sort()) {
      const raw = fs.readFileSync(path.join(steeringDir, f), 'utf8');
      const { data } = parseFrontmatter(raw);
      const inclusion = data.inclusion ?? 'manual';
      if (inclusion === 'always') alwaysLines += countEffectiveLines(raw);
      steering.push({ file: f, inclusion, pointerHits: pointerHits.get(f) ?? 0 });
    }
  }

  // Flags — plain strings the playbook can surface with suggested fixes.
  const flags = [];
  if (alwaysLines > CAPS.alwaysBudget) {
    flags.push(`residency: always-loaded is ${alwaysLines}/${CAPS.alwaysBudget} lines — distill via /sdlc:steer`);
  }
  const shipped = changes.filter((c) => c.archived);
  for (const s of steering.filter((s) => s.inclusion === 'paths' && s.pointerHits === 0)) {
    if (shipped.length >= 2) {
      flags.push(`steering/${s.file}: zero pointer hits across ${shipped.length} shipped changes — demote or delete`);
    }
  }
  for (const c of changes) {
    if (c.compacts > 0) flags.push(`${c.id}: ${c.compacts} compact event(s) — context overflowed, find the resident artifact`);
    if (c.verify.rounds > 3) flags.push(`${c.id}: ${c.verify.rounds} verify rounds — contract or routing needs attention`);
  }
  for (const c of shipped.filter((c) => c.digest === false)) {
    flags.push(`${c.id}: archived without digest.md — ship playbook step 4 was skipped`);
  }

  const firstPassRuns = changes.filter((c) => c.verify.firstPass !== null);
  const summary = {
    active: changes.filter((c) => !c.archived).length,
    shipped: shipped.length,
    firstPassRate: firstPassRuns.length
      ? Number((firstPassRuns.filter((c) => c.verify.firstPass).length / firstPassRuns.length).toFixed(2))
      : null,
  };

  return {
    summary,
    changes,
    residency: { alwaysLines, budget: CAPS.alwaysBudget },
    steering,
    flags,
  };
}

const fmtK = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n));

export function renderReport(report) {
  const lines = [];
  const { summary, residency } = report;
  lines.push(`changes: ${summary.active} active · ${summary.shipped} shipped`
    + (summary.firstPassRate != null ? ` · first-pass ${(summary.firstPassRate * 100).toFixed(0)}%` : ''));
  lines.push(`residency: ${residency.alwaysLines}/${residency.budget} always-loaded lines`);
  for (const c of report.changes) {
    const t = c.tokens;
    const lead = c.leadTimeMs != null ? ` · lead ${(c.leadTimeMs / 3_600_000).toFixed(1)}h` : '';
    lines.push(`  ${c.archived ? '✓' : '·'} ${c.id} [${c.tier ?? '?'}]`
      + ` ${fmtK(t.input)}in/${fmtK(t.output)}out`
      + (c.costUsd != null ? ` $${c.costUsd}` : '')
      + ` · verify×${c.verify.rounds}${lead}`);
  }
  for (const s of report.steering) {
    lines.push(`  steering/${s.file} [${s.inclusion}] hits:${s.pointerHits}`);
  }
  for (const f of report.flags) lines.push(`  ⚠ ${f}`);
  return lines.join('\n');
}

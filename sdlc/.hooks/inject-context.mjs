#!/usr/bin/env node
// SessionStart hook — THE static-context loader. Emits (hard cap 60 lines):
//   constitution + every `inclusion: always` steering file + a one-line
//   pointer to the active change. Everything else stays dynamic.
// Journals what was injected so /sdlc:observe can price residency honestly.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveRoots, readStdinJson, activeChange, appendJournal } from './_shared.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { CAPS } from './lib/caps.mjs';

const { sdlcRoot } = resolveRoots(import.meta.url);

async function main() {
  await readStdinJson(); // drain; content not needed
  if (!fs.existsSync(sdlcRoot)) return;

  const injected = [];
  const out = [];

  const constitutionPath = path.join(sdlcRoot, 'context', 'constitution.md');
  if (fs.existsSync(constitutionPath)) {
    out.push(fs.readFileSync(constitutionPath, 'utf8').trim());
    injected.push('context/constitution.md');
  }

  const steeringDir = path.join(sdlcRoot, 'context', 'steering');
  if (fs.existsSync(steeringDir)) {
    for (const f of fs.readdirSync(steeringDir).filter((n) => n.endsWith('.md')).sort()) {
      const raw = fs.readFileSync(path.join(steeringDir, f), 'utf8');
      const { data, body } = parseFrontmatter(raw);
      if (data.inclusion !== 'always') continue;
      out.push(body.trim());
      injected.push(`context/steering/${f}`);
    }
  }

  const active = activeChange(sdlcRoot);
  if (active) out.push(`Active change: sdlc/changes/${active}/change.md — run /sdlc:next for status.`);

  if (!out.length) return;

  let lines = out.join('\n\n').split('\n');
  if (lines.length > CAPS.alwaysBudget) {
    lines = lines.slice(0, CAPS.alwaysBudget);
    lines.push(`[sdlc] static context truncated at ${CAPS.alwaysBudget} lines — run /sdlc:steer to distill (validate also flags this).`);
  }
  console.log(lines.join('\n'));

  appendJournal(sdlcRoot, active, { event: 'inject', files: injected, lines: lines.length });
}

main().catch(() => process.exit(0)); // fail open

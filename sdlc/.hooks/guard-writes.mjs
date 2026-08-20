#!/usr/bin/env node
// PreToolUse hook — the deterministic guardrail ("things the agent should
// never forget but often does"). Denies direct edits to:
//   sdlc/specs/**              outside an open ship gate
//   sdlc/changes/archive/**    outside an open ship gate
//   sdlc/context/constitution.md (existing) outside an open steer gate
//   sdlc/.state/** and any journal.ndjson   always (machine-owned)
// The sanctioned paths are the CLI (`warnyin-sdlc archive`) and the gates
// opened by `journal.mjs open-ship|open-steer`.

import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import {
  resolveRoots, readStdinJson, readPhase, activeChange, appendJournal, toPosixRel, lexicalPosixRel,
} from './_shared.mjs';

const { sdlcRoot, projectRoot } = resolveRoots(import.meta.url);

function deny(reason, rel) {
  appendJournal(sdlcRoot, activeChange(sdlcRoot), { event: 'guard', action: 'deny', path: rel, reason });
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

// Evaluate the lock rules against ONE view of the path. Returns true when a
// deny was emitted. Rules must hold for BOTH the lexical (claimed) and the
// realpath-resolved view — a symlink must never weaken a lock.
function guard(rel, phase) {
  if (rel.startsWith('sdlc/.state/') || rel.endsWith('journal.ndjson')) {
    deny(`"${rel}" is machine-owned (hooks/CLI write it) — never edit it by hand.`, rel);
    return true;
  }
  if (rel.startsWith('sdlc/specs/') || rel.startsWith('sdlc/changes/archive/')) {
    if (phase?.phase === 'ship') return false;
    deny(
      `"${rel}" is write-locked outside ship. Living specs change only by merging a change's Delta: `
      + 'run `warnyin-sdlc archive <id>` (or `node sdlc/.hooks/journal.mjs open-ship <id>` first if you must edit).',
      rel,
    );
    return true;
  }
  if (rel === 'sdlc/context/constitution.md' && fs.existsSync(path.join(projectRoot, rel))) {
    if (phase?.phase === 'steer' || phase?.phase === 'ship') return false;
    deny(
      'The constitution is always-loaded context — edits go through /sdlc:steer '
      + '(`node sdlc/.hooks/journal.mjs open-steer` opens the gate).',
      rel,
    );
    return true;
  }
  return false;
}

async function main() {
  const input = await readStdinJson();
  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (!filePath || !fs.existsSync(sdlcRoot)) return;

  const abs = path.resolve(projectRoot, filePath);
  const relLexical = lexicalPosixRel(projectRoot, abs);
  const relReal = toPosixRel(projectRoot, abs);

  // A path that CLAIMS to live under sdlc/ but resolves elsewhere (or out of
  // the project) went through a symlink — deny conservatively; a symlink must
  // never disable the write-lock.
  if (relLexical?.startsWith('sdlc/') && relReal !== relLexical) {
    deny(`"${relLexical}" resolves through a symlink to "${relReal ?? 'outside the project'}" — refusing to touch it.`, relLexical);
    return;
  }

  const phase = readPhase(sdlcRoot);
  for (const rel of new Set([relLexical, relReal].filter(Boolean))) {
    if (rel.startsWith('sdlc/') && guard(rel, phase)) return;
  }
}

main().catch(() => process.exit(0)); // fail open

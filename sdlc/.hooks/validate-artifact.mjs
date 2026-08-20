#!/usr/bin/env node
// PostToolUse hook — two token-lean feedback loops:
//  (a) a write under sdlc/  → targeted structural validation, warnings back
//      to the model as additionalContext (fix drift the moment it happens);
//  (b) a source-file write matching a steering pathMatch → emit a POINTER to
//      that steering file, once per session (a pointer, never the content —
//      dynamic context loading at near-zero cost). Hits are journaled so the
//      learner can expire steering that never fires.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveRoots, readStdinJson, activeChange, appendJournal, toPosixRel } from './_shared.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { matchGlob } from './lib/glob.mjs';
import { validateChange, validateContext, formatIssues } from './lib/validate.mjs';

const { sdlcRoot, projectRoot } = resolveRoots(import.meta.url);

function respond(context) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
  }));
}

function validateSdlcWrite(rel) {
  let issues = [];
  const changeMatch = rel.match(/^sdlc\/changes\/([^/]+)\//);
  if (changeMatch && changeMatch[1] !== 'archive') {
    issues = validateChange(path.join(sdlcRoot, 'changes', changeMatch[1]), {
      specsDir: path.join(sdlcRoot, 'specs'),
    });
  } else if (rel.startsWith('sdlc/context/') || rel === 'sdlc/harness.md') {
    issues = validateContext(sdlcRoot);
  }
  if (issues.length) {
    respond(`[sdlc validate]\n${formatIssues(issues)}\nFix errors before moving to the next stage.`);
  }
}

function steeringPointer(rel, sessionId) {
  const steeringDir = path.join(sdlcRoot, 'context', 'steering');
  if (!fs.existsSync(steeringDir)) return;

  const safeSession = String(sessionId ?? '').replace(/[^A-Za-z0-9_-]/g, '') || 'nosession';
  const seenPath = path.join(sdlcRoot, '.state', `pointers-${safeSession}.json`);
  let seen = [];
  try { seen = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* first hit */ }

  const hits = [];
  for (const f of fs.readdirSync(steeringDir).filter((n) => n.endsWith('.md')).sort()) {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(steeringDir, f), 'utf8'));
    if (data.inclusion !== 'paths' || !Array.isArray(data.pathMatch)) continue;
    if (!matchGlob(rel, data.pathMatch)) continue;
    appendJournal(sdlcRoot, activeChange(sdlcRoot), { event: 'pointer', steering: f, file: rel });
    if (!seen.includes(f)) hits.push(f);
  }
  if (!hits.length) return;

  fs.mkdirSync(path.dirname(seenPath), { recursive: true });
  fs.writeFileSync(seenPath, JSON.stringify([...seen, ...hits]));
  respond(
    'Steering applies to this area — read before editing further: '
    + hits.map((f) => `sdlc/context/steering/${f}`).join(', '),
  );
}

async function main() {
  const input = await readStdinJson();
  const filePath = input?.tool_input?.file_path;
  if (!filePath || !fs.existsSync(sdlcRoot)) return;

  const rel = toPosixRel(projectRoot, path.resolve(projectRoot, filePath));
  if (!rel) return;

  if (rel.startsWith('sdlc/')) validateSdlcWrite(rel);
  else steeringPointer(rel, input?.session_id);
}

main().catch(() => process.exit(0)); // fail open

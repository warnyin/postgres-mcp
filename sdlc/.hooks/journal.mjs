#!/usr/bin/env node
// Gate + journal utility. Called by playbooks (sanctioned phase transitions)
// and wired as the PreCompact hook (`journal.mjs note compact`).
//
//   node sdlc/.hooks/journal.mjs open-ship <change-id>   unlock specs/archive writes (TTL 30m)
//   node sdlc/.hooks/journal.mjs open-steer              unlock constitution edits (TTL 30m)
//   node sdlc/.hooks/journal.mjs close                   close any open gate
//   node sdlc/.hooks/journal.mjs set-active <change-id>  attribute sessions/events to a change
//   node sdlc/.hooks/journal.mjs note <name> [k=v ...]   append a journal event

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  resolveRoots, readStdinJson, writePhase, clearPhase, activeChange, appendJournal,
} from './_shared.mjs';

const { sdlcRoot } = resolveRoots(import.meta.url);

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'open-ship') {
    const change = rest[0];
    if (!change) { console.error('usage: journal.mjs open-ship <change-id>'); process.exit(2); }
    const phase = writePhase(sdlcRoot, { phase: 'ship', change });
    appendJournal(sdlcRoot, change, { event: 'gate', gate: 'ship', action: 'open', expires: phase.expires });
    console.log(`ship gate open for "${change}" until ${phase.expires}`);
  } else if (cmd === 'open-steer') {
    const phase = writePhase(sdlcRoot, { phase: 'steer' });
    appendJournal(sdlcRoot, null, { event: 'gate', gate: 'steer', action: 'open', expires: phase.expires });
    console.log(`steer gate open until ${phase.expires}`);
  } else if (cmd === 'close') {
    clearPhase(sdlcRoot);
    console.log('gate closed');
  } else if (cmd === 'set-active') {
    const change = rest[0];
    if (!change) { console.error('usage: journal.mjs set-active <change-id>'); process.exit(2); }
    fs.mkdirSync(path.join(sdlcRoot, '.state'), { recursive: true });
    fs.writeFileSync(path.join(sdlcRoot, '.state', 'active.json'), JSON.stringify({ change }));
    console.log(`active change: ${change}`);
  } else if (cmd === 'note') {
    // When used as a hook, drain stdin so the harness never blocks on us.
    if (!process.stdin.isTTY) await readStdinJson();
    const name = rest[0] ?? 'note';
    const extra = {};
    for (const kv of rest.slice(1)) {
      const [k, ...v] = kv.split('=');
      if (k && v.length) extra[k] = v.join('=');
    }
    appendJournal(sdlcRoot, activeChange(sdlcRoot), { event: name, ...extra });
  } else {
    console.error('usage: journal.mjs open-ship|open-steer|close|set-active|note ...');
    process.exit(2);
  }
}

main().catch(() => process.exit(0)); // fail open

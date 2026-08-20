// Manifest + prune guards (ported from the battle-tested warnyin-agents
// installer). The manifest records sha256 of every payload-owned file so
// `update` can distinguish ours-unmodified (refresh), ours-modified-by-user
// (keep + warn), and stale (prune with guards).

import fs from 'node:fs';
import path from 'node:path';

export const PRUNE_BLAST_CAP = 50;

// Payload-owned roots — prune may only ever touch paths under these.
const PRUNABLE_PREFIXES = [
  'sdlc/.playbook/',
  'sdlc/.hooks/',
  '.claude/commands/sdlc/',
];
const AGENT_ALLOW_RE = /^\.claude\/agents\/sdlc-[^/]+\.md$/;
const SKILL_ALLOW_RE = /^\.claude\/skills\/(delta-spec-format|contract-writing|sdlc-conventions)\/[^/]+$/;
const ADAPTER_ALLOW = new Set([
  '.cursor/rules/sdlc.mdc',
  '.windsurf/rules/sdlc.md',
]);

export function parseManifest(text) {
  const map = new Map();
  for (const line of (text ?? '').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const m = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
    if (!m) continue;
    map.set(m[2], m[1]);
  }
  return map;
}

export function renderManifest(map) {
  const lines = ['# @warnyin/sdlc manifest — sha256  path (posix, relative to project root)'];
  for (const [p, hash] of [...map.entries()].sort()) lines.push(`${hash}  ${p}`);
  return lines.join('\n') + '\n';
}

// Guard 1: structural path safety (manifest is data — never trust it blindly).
export function isSafeRelPath(relPosix) {
  if (typeof relPosix !== 'string' || relPosix === '') return false;
  if (relPosix.includes('\\') || relPosix.startsWith('/') || /^[A-Za-z]:/.test(relPosix)) return false;
  if (/[\u0000-\u001f]/.test(relPosix)) return false;
  const segments = relPosix.split('/');
  return segments.every((s) => s !== '' && s !== '.' && s !== '..');
}

// Guard 2: scope — only payload-owned locations are ever prunable.
export function isPrunablePath(relPosix) {
  if (!isSafeRelPath(relPosix)) return false;
  if (PRUNABLE_PREFIXES.some((p) => relPosix.startsWith(p))) return true;
  if (AGENT_ALLOW_RE.test(relPosix)) return true;
  if (SKILL_ALLOW_RE.test(relPosix)) return true;
  if (ADAPTER_ALLOW.has(relPosix)) return true;
  return false;
}

// Stale = in the old manifest but absent from the new payload set.
// Every candidate must pass path + scope guards; the caller additionally
// checks hash-match-on-disk and realpath containment before deleting.
export function computeStale(oldManifest, newPaths) {
  const stale = [];
  const rejected = [];
  for (const [relPath, hash] of oldManifest.entries()) {
    if (newPaths.has(relPath)) continue;
    if (!isPrunablePath(relPath)) {
      rejected.push({ path: relPath, reason: 'outside prunable scope' });
      continue;
    }
    stale.push({ path: relPath, hash });
  }
  return { stale, rejected, overCap: stale.length > PRUNE_BLAST_CAP };
}

export function containedIn(rootAbs, targetAbs) {
  const rel = path.relative(rootAbs, targetAbs);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Guard: no path segment between root and target may be a symlink. Without
// this, a symlinked ancestor inside a prunable prefix redirects the delete to
// whatever real file it points at (arbitrary-deletion class — the manifest is
// untrusted, user-writable input).
export function hasSymlinkSegment(rootAbs, targetAbs) {
  const rel = path.relative(rootAbs, targetAbs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return true; // suspicious → treat as unsafe
  let cur = rootAbs;
  for (const seg of rel.split(path.sep)) {
    cur = path.join(cur, seg);
    try {
      if (fs.lstatSync(cur).isSymbolicLink()) return true;
    } catch {
      return false; // component missing — nothing to follow
    }
  }
  return false;
}

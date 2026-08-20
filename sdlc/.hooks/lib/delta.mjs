// Delta-spec grammar (parser keys are frozen English regardless of any
// UI language):
//
//   ## Delta: <capability>
//   ### ADDED Requirement: <name>
//   The system SHALL <behavior>.
//   #### Scenario: <name>
//   - WHEN <condition>
//   - THEN <outcome>
//   ### MODIFIED Requirement: <existing name>   ← full replacement body
//   ### REMOVED Requirement: <existing name>
//
// Requirement heading text is the identity key (OpenSpec convention).
// `mergeDelta` applies ops mechanically to a living spec; a missing key on
// MODIFIED/REMOVED is a hard error — never merge silently.

const DELTA_HEAD = /^## Delta:\s*(.+?)\s*$/;
const OP_HEAD = /^### (ADDED|MODIFIED|REMOVED) Requirement:\s*(.+?)\s*$/;
const BAD_OP_HEAD = /^### (\w+) Requirement:/;
const SPEC_REQ_HEAD = /^### Requirement:\s*(.+?)\s*$/;

export function parseDelta(changeText) {
  const lines = (changeText ?? '').split(/\r?\n/);
  const deltas = [];
  const errors = [];
  let current = null;   // { capability, ops }
  let currentOp = null; // { op, name, bodyLines }

  const closeOp = () => {
    if (!currentOp) return;
    const body = currentOp.bodyLines.join('\n').trim();
    if (currentOp.op !== 'REMOVED' && body === '') {
      errors.push(`${currentOp.op} Requirement "${currentOp.name}" has an empty body`);
    }
    current.ops.push({ op: currentOp.op, name: currentOp.name, body });
    currentOp = null;
  };

  for (const line of lines) {
    const deltaMatch = line.match(DELTA_HEAD);
    if (deltaMatch) {
      closeOp();
      // Repeated `## Delta: <cap>` blocks merge into one entry — otherwise the
      // last block would silently overwrite the first at ship time.
      const existing = deltas.find((d) => d.capability.toLowerCase() === deltaMatch[1].toLowerCase());
      current = existing ?? { capability: deltaMatch[1], ops: [] };
      if (!existing) deltas.push(current);
      continue;
    }
    if (/^## /.test(line) && !deltaMatch) {
      closeOp();
      current = null; // left the delta section
      continue;
    }
    if (!current) continue;

    const opMatch = line.match(OP_HEAD);
    if (opMatch) {
      closeOp();
      currentOp = { op: opMatch[1], name: opMatch[2], bodyLines: [] };
      continue;
    }
    const badOp = line.match(BAD_OP_HEAD);
    if (badOp && !opMatch) {
      errors.push(`Unknown delta operation "${badOp[1]}" (use ADDED, MODIFIED, or REMOVED)`);
      continue;
    }
    if (currentOp) currentOp.bodyLines.push(line);
  }
  closeOp();

  for (const d of deltas) {
    const seen = new Set();
    for (const op of d.ops) {
      const key = op.name.toLowerCase();
      if (seen.has(key)) errors.push(`Duplicate requirement "${op.name}" in Delta: ${d.capability}`);
      seen.add(key);
    }
    if (d.ops.length === 0) errors.push(`Delta: ${d.capability} declares no requirement operations`);
  }

  return { deltas, errors };
}

export function parseSpec(specText) {
  const lines = (specText ?? '').split(/\r?\n/);
  const requirements = [];
  const preamble = [];
  let current = null;

  for (const line of lines) {
    const reqMatch = line.match(SPEC_REQ_HEAD);
    if (reqMatch) {
      current = { name: reqMatch[1], bodyLines: [] };
      requirements.push(current);
      continue;
    }
    if (current) current.bodyLines.push(line);
    else preamble.push(line);
  }

  return {
    preamble: preamble.join('\n').replace(/\n+$/, ''),
    requirements: requirements.map((r) => ({
      name: r.name,
      body: r.bodyLines.join('\n').trim(),
    })),
  };
}

export function renderSpec({ preamble, requirements }) {
  const parts = [preamble.replace(/\n+$/, '')];
  for (const r of requirements) {
    parts.push(`\n### Requirement: ${r.name}\n${r.body}`);
  }
  return parts.join('\n').replace(/\n+$/, '\n');
}

export function newSpecPreamble(capability) {
  return [
    `# Spec: ${capability}`,
    '',
    '## Purpose',
    '<!-- one or two lines; commands grep this header first (progressive disclosure) -->',
    '',
    '## Requirements',
  ].join('\n');
}

// Apply one capability's ops to a living spec (or null to create it).
// Returns { ok, content, errors }.
export function mergeDelta(specText, ops, capability) {
  const errors = [];
  const spec = specText == null
    ? { preamble: newSpecPreamble(capability), requirements: [] }
    : parseSpec(specText);

  const byName = new Map(spec.requirements.map((r) => [r.name.toLowerCase(), r]));

  for (const { op, name, body } of ops) {
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (op === 'ADDED') {
      if (existing) { errors.push(`ADDED Requirement "${name}" already exists in spec "${capability}"`); continue; }
      const req = { name, body };
      spec.requirements.push(req);
      byName.set(key, req);
    } else if (op === 'MODIFIED') {
      if (!existing) { errors.push(`MODIFIED Requirement "${name}" not found in spec "${capability}"`); continue; }
      existing.body = body;
    } else if (op === 'REMOVED') {
      if (!existing) { errors.push(`REMOVED Requirement "${name}" not found in spec "${capability}"`); continue; }
      spec.requirements = spec.requirements.filter((r) => r.name.toLowerCase() !== key);
      byName.delete(key);
    }
  }

  if (errors.length) return { ok: false, content: null, errors };
  return { ok: true, content: renderSpec(spec), errors: [] };
}

// Minimal YAML-frontmatter reader (zero-dep). Supports the subset this
// framework writes: strings, numbers, booleans, inline arrays, and
// simple `- item` lists. Anything fancier is a validation error upstream.

const FENCE = '---';

export function parseFrontmatter(text) {
  if (typeof text !== 'string') return { data: {}, body: '' };
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== FENCE) return { data: {}, body: text };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FENCE) { end = i; break; }
  }
  if (end === -1) return { data: {}, body: text };

  const data = {};
  let currentListKey = null;
  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;

    const listItem = raw.match(/^\s+-\s+(.*)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(coerce(listItem[1].trim()));
      continue;
    }

    const kv = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const value = rawValue.trim();
    if (value === '') {
      data[key] = [];
      currentListKey = key;
    } else {
      data[key] = coerce(value);
      currentListKey = null;
    }
  }

  return { data, body: lines.slice(end + 1).join('\n') };
}

function coerce(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((v) => coerce(v.trim()));
  }
  const unquoted = value.replace(/^["']|["']$/g, '');
  if (unquoted !== value) return unquoted;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

// Minimal reader for sdlc/config.yaml — supports exactly what the template
// documents: scalar keys, inline arrays, and a `prices:` block of inline
// objects. Anything else is ignored (never crash a hook on config).

export function parseConfig(text) {
  const config = { language: 'en', tools: [], prices: null };
  const lines = (text ?? '').split(/\r?\n/);
  let inPrices = false;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const isIndented = /^\s/.test(raw);
    if (!isIndented) inPrices = false;

    if (inPrices) {
      const m = raw.match(/^\s+([^:#]+):\s*\{(.*)\}\s*$/);
      if (!m) continue;
      const model = m[1].trim();
      const obj = {};
      for (const part of m[2].split(',')) {
        const kv = part.split(':');
        if (kv.length !== 2) continue;
        const num = Number(kv[1].trim());
        if (!Number.isNaN(num)) obj[kv[0].trim()] = num;
      }
      config.prices = { ...(config.prices ?? {}), [model]: obj };
      continue;
    }

    const kv = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, valueRaw] = kv;
    const value = valueRaw.replace(/\s+#.*$/, '').trim();
    if (key === 'prices' && value === '') { inPrices = true; continue; }
    if (value.startsWith('[') && value.endsWith(']')) {
      config[key] = value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (value !== '') {
      config[key] = value;
    }
  }
  return config;
}

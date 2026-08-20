// Transcript-usage parser: Claude Code transcripts are JSONL; assistant
// entries carry `message.usage` and `message.model`. We sum per model and
// price via the optional table in sdlc/config.yaml. Never guess: when a
// price is unknown, cost stays null (reported as n/a).

export function parseTranscriptUsage(jsonlText) {
  const byModel = new Map();
  for (const line of (jsonlText ?? '').split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry?.message;
    const usage = msg?.usage;
    if (!usage || typeof usage !== 'object') continue;
    const model = msg.model ?? 'unknown';
    const acc = byModel.get(model) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    acc.input += usage.input_tokens ?? 0;
    acc.output += usage.output_tokens ?? 0;
    acc.cacheRead += usage.cache_read_input_tokens ?? 0;
    acc.cacheWrite += usage.cache_creation_input_tokens ?? 0;
    byModel.set(model, acc);
  }
  const models = Object.fromEntries(byModel);
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const m of byModel.values()) {
    totals.input += m.input; totals.output += m.output;
    totals.cacheRead += m.cacheRead; totals.cacheWrite += m.cacheWrite;
  }
  return { models, totals };
}

// prices: { "<model>": { input, output, cacheRead } } in USD per 1M tokens.
export function costUsd(usage, prices) {
  if (!prices) return null;
  let usd = 0;
  let priced = false;
  for (const [model, u] of Object.entries(usage.models)) {
    const p = prices[model];
    if (!p) continue;
    priced = true;
    usd += (u.input * (p.input ?? 0)
      + u.output * (p.output ?? 0)
      + u.cacheRead * (p.cacheRead ?? 0)) / 1_000_000;
  }
  return priced ? Number(usd.toFixed(4)) : null;
}

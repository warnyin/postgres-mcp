// Non-destructive management of our hook entries inside the project's
// .claude/settings.json. Ownership marker: any hook command that references
// `sdlc/.hooks/` is ours; everything else is the user's and is never touched.
// Merge is idempotent: remove ours, re-add current set, preserve the rest.

const OWNERSHIP_MARKER = 'sdlc/.hooks/';

const hookCmd = (script, extraArgs = '') =>
  `node "$CLAUDE_PROJECT_DIR/sdlc/.hooks/${script}"${extraArgs ? ' ' + extraArgs : ''}`;

export function sdlcHookEntries() {
  return {
    SessionStart: [
      { hooks: [{ type: 'command', command: hookCmd('inject-context.mjs') }] },
    ],
    PreToolUse: [
      {
        matcher: 'Edit|Write|MultiEdit|NotebookEdit',
        hooks: [{ type: 'command', command: hookCmd('guard-writes.mjs') }],
      },
    ],
    PostToolUse: [
      {
        matcher: 'Edit|Write|MultiEdit',
        hooks: [{ type: 'command', command: hookCmd('validate-artifact.mjs') }],
      },
    ],
    Stop: [
      { hooks: [{ type: 'command', command: hookCmd('session-summary.mjs') }] },
    ],
    PreCompact: [
      { hooks: [{ type: 'command', command: hookCmd('journal.mjs', 'note compact') }] },
    ],
  };
}

function isOurs(matcherEntry) {
  return (matcherEntry?.hooks ?? []).some(
    (h) => typeof h?.command === 'string' && h.command.includes(OWNERSHIP_MARKER),
  );
}

// settingsJson: parsed object (or {}). Returns a NEW object (immutability).
export function mergeHookSettings(settingsJson) {
  const settings = structuredClone(settingsJson ?? {});
  const hooks = { ...(settings.hooks ?? {}) };
  for (const [event, entries] of Object.entries(sdlcHookEntries())) {
    const existing = (hooks[event] ?? []).filter((e) => !isOurs(e));
    hooks[event] = [...existing, ...entries];
  }
  return { ...settings, hooks };
}

export function removeHookSettings(settingsJson) {
  const settings = structuredClone(settingsJson ?? {});
  if (!settings.hooks) return settings;
  const hooks = {};
  for (const [event, entries] of Object.entries(settings.hooks)) {
    const kept = entries.filter((e) => !isOurs(e));
    if (kept.length) hooks[event] = kept;
  }
  return { ...settings, hooks };
}

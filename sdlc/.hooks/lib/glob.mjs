// Tiny glob matcher for steering pathMatch patterns. Supports the subset we
// document: `**` (any depth), `*` (within a segment), literal text.
// Paths are compared as POSIX, relative to the project root.

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` or trailing `**` — match any depth including nothing
        if (glob[i + 2] === '/') { re += '(?:[^/]+/)*'; i += 2; }
        else { re += '.*'; i += 1; }
      } else {
        re += '[^/]*';
      }
    } else if ('.+^$()[]{}|\\?'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchGlob(relPosixPath, patterns) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  return list.some((p) => globToRegExp(String(p)).test(relPosixPath));
}

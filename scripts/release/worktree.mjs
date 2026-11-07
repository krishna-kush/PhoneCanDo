// Is the working tree exactly the commit we release? Pure: the output of a
// porcelain status listing (io/git.mjs reads it) in, the entries that stop
// the release out.

/**
 * [{ code: 'XY', path, from? }] from `status --porcelain=v1 -z` output.
 * Renames and copies carry their source path in `from`.
 */
export function parsePorcelain(raw) {
  const fields = raw.split('\0');
  const out = [];
  for (let i = 0; i < fields.length; i += 1) {
    if (!fields[i]) continue;
    const entry = { code: fields[i].slice(0, 2), path: fields[i].slice(3) };
    // -z puts the source of a rename or copy in the next field.
    if (/[RC]/.test(entry.code)) {
      i += 1;
      entry.from = fields[i];
    }
    out.push(entry);
  }
  return out;
}

/**
 * The entries that stop a release: everything except an in-place edit
 * (staged, unstaged or both) of a path in `allow`. Untracked, deleted,
 * renamed and conflicted files always count.
 */
export function dirtyEntries(entries, allow = []) {
  return entries.filter((entry) => !(allow.includes(entry.path) && !entry.from && /^(M | M|MM)$/.test(entry.code)));
}

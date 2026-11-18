// The campaigns we made: D1's `campaigns` rows (migration 0005; ./manage
// campaign add writes them, and the Worker counts only these tags), read in
// the same batch as the counts (links/queries.mjs, campaignList), so a
// campaign added meanwhile shows up on the next refresh. Pure: rows in, list
// out.

/** [{ tag, note, added }] from the rows, in their order; a row without a tag is skipped. */
export function campaignListOf(rows = []) {
  return rows
    .filter((c) => typeof c?.tag === 'string' && c.tag)
    .map((c) => ({ tag: c.tag, note: typeof c.note === 'string' ? c.note : '', added: typeof c.added === 'string' && c.added ? c.added : null }));
}

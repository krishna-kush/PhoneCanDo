// The new tables (links/queries.mjs NEW_TABLES: 0005's campaign_daily and
// campaigns) may not be on the live database yet: we apply a migration with
// cf before the push that needs it, and the data script may run before that. A D1 batch that names a missing table fails as
// a whole, so the script reads again with that one table left out, once per
// missing table, and its tab says "not set up yet". Tables that are there
// are always read. Any other failure is reported as before.

import { NEW_TABLES } from './queries.mjs';

/** The new table a D1 error message says is missing, or null. */
export function missingNewTable(message) {
  const m = /no such table:\s*(?:main\.)?([A-Za-z_]\w*)/i.exec(String(message ?? ''));
  return m && NEW_TABLES.includes(m[1]) ? m[1] : null;
}

/**
 * Runs `read(missing)` with every table and, each time D1 answers that a new
 * table is missing, once more without that one too (at most once per new
 * table). Resolves read's result plus `missing`, the tables left out.
 */
export async function readWithNewTables(read) {
  const missing = [];
  for (;;) {
    try {
      return { ...(await read([...missing])), missing };
    } catch (e) {
      const table = missingNewTable(e?.message);
      // A table already left out cannot be missing again: that is another failure.
      if (!table || missing.includes(table)) throw e;
      missing.push(table);
    }
  }
}

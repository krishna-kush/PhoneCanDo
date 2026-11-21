// The campaigns list on the remote D1 database (table `campaigns`, migration
// 0006), through the logged-in cf CLI (tce/scripts/cf-d1.mjs). The Worker
// counts a `?c=<tag>` only while its tag is there, so a row added here counts
// from that moment: nothing to commit or push. Tag, note and day go to cf as
// --params, never into the SQL. Nothing runs on import or before the first
// call; tests hand in their own `spawn` and `databaseId`.
import { cfD1Query } from '../../tce/scripts/cf-d1.mjs';
import { d1DatabaseOf, readWranglerConfig } from '../../tce/scripts/wrangler-config.mjs';
import { stop } from './errors.mjs';

const FIND = 'SELECT tag, note, added FROM campaigns WHERE tag = ?';
const INSERT = 'INSERT INTO campaigns (tag, note, added) VALUES (?, ?, ?)';
const LIST = 'SELECT tag, note, added FROM campaigns ORDER BY added, tag';

/** The DB binding's database id, from tce/hosts/cloudflare/wrangler.jsonc. */
function liveDatabaseId() {
  try {
    return d1DatabaseOf(readWranglerConfig()).database_id;
  } catch (e) {
    return stop(e.message);
  }
}

/** A Stop that says what went wrong in words we can act on. */
function failed(e, id, params) {
  const message = String(e?.message ?? e);
  if (/no such table:\s*(?:main\.)?campaigns\b/i.test(message)) {
    stop(
      'the campaigns table is not on the database yet: migration 0005 is not applied. Apply it with cf first ' +
        `(we never run it from here):\n  cf d1 migrations apply ${id} --dir tce/stores/sql/migrations`,
    );
  }
  if (/UNIQUE constraint failed:\s*campaigns\.tag/i.test(message)) stop(`campaign '${params[0]}' is already listed: pick another tag`);
  stop(`campaigns on D1: ${message}`);
}

/** { find(tag), add({ tag, note, added }), list() } on the live database; `spawn` and `databaseId` are for tests. */
export function campaignsD1({ spawn, databaseId } = {}) {
  let id = databaseId;
  const run = (sql, params = []) => {
    id ??= liveDatabaseId();
    try {
      const [rows] = cfD1Query(id, sql, params, spawn ? { spawn } : {});
      return rows ?? [];
    } catch (e) {
      return failed(e, id, params);
    }
  };
  return {
    find: (tag) => run(FIND, [tag])[0] ?? null,
    add: ({ tag, note, added }) => void run(INSERT, [tag, note, added]),
    list: () => run(LIST),
  };
}

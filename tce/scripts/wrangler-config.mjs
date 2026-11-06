// Reads the Worker's wrangler config (hosts/cloudflare/wrangler.jsonc) for the
// read-only scripts: the D1 database id and the Worker name. Zero deps.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The tce/ directory. */
export const TCE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** The repo root. */
export const ROOT = resolve(TCE, '..');
/** The Worker's wrangler config. */
export const WRANGLER = join(TCE, 'hosts/cloudflare/wrangler.jsonc');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strips line and block comments outside strings, then trailing commas: enough JSONC for wrangler configs. */
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/** Parses the wrangler config; throws with the repo-relative path when it is missing. */
export function readWranglerConfig(path = WRANGLER) {
  if (!existsSync(path)) throw new Error(`${relative(ROOT, path)} not found`);
  return parseJsonc(readFileSync(path, 'utf8'));
}

/** The `DB` binding's D1 entry (or the first one); throws when it has no database_id yet. */
export function d1DatabaseOf(config, path = WRANGLER) {
  const dbs = config.d1_databases ?? [];
  const db = dbs.find((d) => d.binding === 'DB') ?? dbs[0];
  if (!db) throw new Error(`no d1_databases entry in ${relative(ROOT, path)}`);
  if (!UUID.test(db.database_id ?? '')) {
    throw new Error(`D1 database "${db.database_name ?? db.binding}" has no database_id in ${relative(ROOT, path)} yet (it is filled in once the database exists)`);
  }
  return db;
}

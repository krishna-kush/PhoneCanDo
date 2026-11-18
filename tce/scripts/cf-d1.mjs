// Runs SQL on the remote D1 database through the logged-in `cf` CLI, for the
// scripts we run on our own machines (stats.mjs reads, ./manage campaign
// reads and adds): `cf d1 query <database-id> --sql <sql> [--params <p>...]`.
// Values go to cf only as --params, never into the SQL text. Synchronous,
// zero deps; tests hand in their own `spawn`, so nothing reaches Cloudflare.
import { spawnSync } from 'node:child_process';

/** The cf CLI's arguments for one query; a value cf would read as an option is refused. */
export function cfD1Args(databaseId, sql, params = []) {
  const values = params.map(String);
  const flag = values.find((v) => v.startsWith('-'));
  if (flag !== undefined) throw new Error(`a value cannot start with '-' (cf would read "${flag}" as an option)`);
  return ['d1', 'query', databaseId, '--sql', sql, ...(values.length ? ['--params', ...values] : [])];
}

/**
 * One row array per statement in `sql`. cf prints the API's `result` (an
 * array with one entry per statement), bare or wrapped; a statement with
 * `success: false`, a failed run or output that is not JSON throws, in cf's
 * own words.
 */
export function cfD1Query(databaseId, sql, params = [], { spawn = spawnSync } = {}) {
  const r = spawn('cf', cfD1Args(databaseId, sql, params), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error?.code === 'ENOENT') throw new Error('the cf CLI is not on PATH (npm i -g cf, then cf auth login; with nvm, source it first)');
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`cf d1 query exited ${r.status}:\n${(r.stderr || r.stdout).trim()}`);
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    throw new Error(`cf d1 query printed something other than JSON:\n${r.stdout.slice(0, 500)}`);
  }
  const results = Array.isArray(parsed) ? parsed : parsed?.result;
  if (!Array.isArray(results)) throw new Error('cf d1 query returned no result sets');
  return results.map((res, i) => {
    if (res?.success === false) throw new Error(`statement ${i + 1} failed: ${JSON.stringify(res.error ?? res)}`);
    return res?.results ?? [];
  });
}

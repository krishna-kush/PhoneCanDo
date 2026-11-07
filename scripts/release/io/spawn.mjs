// The one place the release preflight spawns a process. git.mjs and gh.mjs
// take a runner, so tests hand them a fake and never start git or gh.
import { spawnSync } from 'node:child_process';

/** (args) => spawnSync's { status, stdout, stderr, error } for `command`, text out. */
export const spawnRunner = (command, options = {}) => (args) =>
  spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });

/** A runner's failure as one line: the spawn error, else stderr, else the exit status. */
export function failure(result) {
  if (result.error) return result.error.message;
  return (result.stderr || '').trim() || `exit ${result.status}`;
}

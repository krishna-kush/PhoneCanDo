// Running commands: the one place ./manage starts a process.
import { spawnSync } from 'node:child_process';
import { dim } from '../terminal/style.mjs';
import { CommandFailed } from './errors.mjs';
import { ROOT } from './paths.mjs';

// Set to a function(cmd, cwd), it is called instead and nothing runs: the
// wiring check (.github/ci/js/check-wiring.mjs) records each command this way.
let record = null;
export function setRecord(fn) {
  record = fn;
}

function spawn(cmd, { cwd = ROOT, env = process.env } = {}) {
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error; // e.g. ENOENT: the program is not installed
  return result.status ?? 1;
}

/** Runs cmd, echoing it; stops ./manage with its exit code when it fails. */
export function sh(cmd, options = {}) {
  if (record) return record(cmd, options.cwd ?? ROOT);
  console.log(dim(`$ ${cmd.join(' ')}`));
  const status = spawn(cmd, options);
  if (status !== 0) throw new CommandFailed(cmd, status);
}

/** Like sh, for reports: their exit status never stops the build. */
export function run(cmd, options = {}) {
  if (record) return record(cmd, options.cwd ?? ROOT);
  spawn(cmd, options);
}

/** A command's stdout ('' when it cannot run). */
export function capture(cmd) {
  if (record) return '';
  const result = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  return result.stdout ?? '';
}

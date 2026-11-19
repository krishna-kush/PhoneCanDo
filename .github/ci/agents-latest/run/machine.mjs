// The kind's machine: a fresh container of the local-model check's machine
// image (.github/ci/local-models/Dockerfile), and commands in it. Env values
// go in by name (`docker exec -e NAME` reads the value from our own env), so
// any value, a newline included, reaches the program as it is and none is on
// a command line. Every command in it runs under `timeout`, so nothing
// outlives its check.
import { capture } from './exec.mjs';

/** `docker exec` for argv in the container, its env by name, in cwd, ended after timeoutSec. */
export function execArgv(container, { argv, env = {}, cwd = '/root', timeoutSec, interactive = false }) {
  const names = Object.keys(env).flatMap((name) => ['-e', name]);
  return [
    'docker',
    'exec',
    ...(interactive ? ['-i'] : []),
    '-w',
    cwd,
    ...names,
    container,
    'timeout',
    '-k',
    '5',
    String(timeoutSec),
    ...argv,
  ];
}

/** Our env for that docker exec: the process's own, the command's on top. */
export function execEnv(env) {
  return { ...process.env, ...env };
}

export async function start(image, name) {
  return capture(['docker', 'run', '-d', '--name', name, '--init', image, 'sleep', 'infinity'], { timeoutMs: 300_000 });
}

export async function remove(name) {
  return capture(['docker', 'rm', '-f', name], { timeoutMs: 60_000 });
}

/** Copies a host folder's contents to `to` in the container (modes kept). */
export async function copyIn(name, from, to) {
  return capture(['docker', 'cp', `${from}/.`, `${name}:${to}`], { timeoutMs: 120_000 });
}

/** Runs argv in the container to its end (capture's result; `timeout`'s 124 reads as timed out). */
export async function run(name, { argv, env = {}, cwd, timeoutSec }) {
  const result = await capture(execArgv(name, { argv, env, cwd, timeoutSec }), {
    env: execEnv(env),
    timeoutMs: (timeoutSec + 30) * 1000,
  });
  return { ...result, timedOut: result.timedOut || result.code === TIMED_OUT };
}

const TIMED_OUT = 124;

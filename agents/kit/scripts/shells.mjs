// The POSIX shells on this host that the kit-script tests run each script
// with: /bin/sh always, and dash, busybox sh and posh when installed, so a
// bashism fails in at least one of them.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;

export const shells = [
  { name: '/bin/sh', argv: ['/bin/sh'] },
  ...[
    { name: 'dash', argv: ['dash'] },
    { name: 'busybox sh', argv: ['busybox', 'sh'] },
    { name: 'posh', argv: ['posh'] },
  ].filter((s) => has(s.argv[0])),
];

/** The script's path next to this file. */
export const scriptPath = (name) => fileURLToPath(new URL(name, import.meta.url));

/** Only what the scripts read: PATH, plus the given HOME and PHONECANDO_* vars. */
const envOf = (env) => ({ PATH: process.env.PATH, ...env });

/** Runs a script with `shell`, stdin from /dev/null unless `input` is given. */
export function run(shell, script, args, { env = {}, input } = {}) {
  const [cmd, ...pre] = shell.argv;
  const r = spawnSync(cmd, [...pre, scriptPath(script), ...args], {
    env: envOf(env),
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 10_000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Starts a script with `shell` in the background, stdin from /dev/null.
 * `pid` is the script's $$ (the shell runs it in its own process); `done`
 * resolves with the exit code, its output and the ms it ran.
 */
export function start(shell, script, args, { env = {} } = {}) {
  const [cmd, ...pre] = shell.argv;
  const started = Date.now();
  const child = spawn(cmd, [...pre, scriptPath(script), ...args], { env: envOf(env), stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (d) => (stdout += d));
  child.stderr.setEncoding('utf8').on('data', (d) => (stderr += d));
  const guard = setTimeout(() => child.kill('SIGKILL'), 30_000);
  const done = new Promise((resolve) => {
    child.on('close', (code) => {
      clearTimeout(guard);
      resolve({ code, stdout, stderr, ms: Date.now() - started });
    });
  });
  return { pid: child.pid, done };
}

/** Runs a script with a stdin pipe nobody writes to or closes; resolves with the exit code and ms taken. */
export function runWithOpenStdin(shell, script, args, { env = {} } = {}) {
  const [cmd, ...pre] = shell.argv;
  const started = Date.now();
  const child = spawn(cmd, [...pre, scriptPath(script), ...args], { env: envOf(env), stdio: ['pipe', 'ignore', 'ignore'] });
  const guard = setTimeout(() => child.kill('SIGKILL'), 10_000);
  return new Promise((resolve) => {
    child.on('exit', (code) => {
      clearTimeout(guard);
      child.stdin.destroy();
      resolve({ code, ms: Date.now() - started });
    });
  });
}

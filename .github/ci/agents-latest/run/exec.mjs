// Runs one command to its end: stdout and stderr in one buffer in the order
// they came (what a person sees in a terminal), killed after a timeout.
import { spawn } from 'node:child_process';

/** The most output kept, from the start. */
export const MAX_OUTPUT = 1024 * 1024;

/**
 * Resolves {code, signal, output, timedOut, secs}; never rejects (a program
 * that cannot start reads as exit 127 with the error as its output).
 */
export function capture(argv, { env = process.env, timeoutMs = 120_000, input = null } = {}) {
  const started = Date.now();
  return new Promise((resolve) => {
    let output = '';
    let timedOut = false;
    const child = spawn(argv[0], argv.slice(1), { env, stdio: [input === null ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    const take = (chunk) => {
      if (output.length < MAX_OUTPUT) output += chunk.toString('utf8').slice(0, MAX_OUTPUT - output.length);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    if (input !== null) child.stdin.end(input);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    const done = (code, signal, extra = '') => {
      clearTimeout(timer);
      resolve({ code, signal, output: output + extra, timedOut, secs: Math.round((Date.now() - started) / 1000) });
    };
    child.on('error', (error) => done(127, null, `${error.message}\n`));
    child.on('close', (code, signal) => done(code, signal));
  });
}

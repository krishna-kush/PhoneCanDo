// An agent's ACP mode, started and sent our runner's initialize
// (logic/acp.mjs) on its stdin; the answer read from its stdout, line by
// line, answering whatever it asks of us first as the runner does. Then its
// stdin closes and it gets a moment to exit before it is killed.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { initializeRequest, readLine } from '../logic/acp.mjs';

const KEPT = 64 * 1024;
const EXIT_GRACE_MS = 3000;

/**
 * Resolves {answer: {result, error} | null, timedOut, code, log, secs}:
 * `answer` null when the agent exited (`code`) or timed out first; `log` is
 * the end of its stderr and of the stdout lines that were no answer.
 */
export function handshake(argv, { env = process.env, timeoutMs = 180_000, version = 'ci' } = {}) {
  const started = Date.now();
  return new Promise((resolve) => {
    let log = '';
    let settled = false;
    const keep = (text) => {
      log = (log + text).slice(-KEPT);
    };
    const child = spawn(argv[0], argv.slice(1), { env, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.on('error', () => {}); // an agent that exits early closes the pipe under us
    child.stderr.on('data', (chunk) => keep(chunk.toString('utf8')));
    const finish = (answer, extra = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const secs = Math.round((Date.now() - started) / 1000);
      resolve({ answer, timedOut: false, code: null, log, secs, ...extra });
      if (child.exitCode === null && child.signalCode === null) {
        child.stdin.end();
        setTimeout(() => child.kill('SIGKILL'), EXIT_GRACE_MS).unref();
      }
    };
    const timer = setTimeout(() => {
      finish(null, { timedOut: true });
      child.kill('SIGKILL');
    }, timeoutMs);
    createInterface({ input: child.stdout }).on('line', (line) => {
      const message = readLine(line);
      if (message?.kind === 'answer') finish({ result: message.result, error: message.error });
      else if (message?.kind === 'request') child.stdin.write(`${message.reply}\n`);
      else keep(`${line}\n`);
    });
    child.on('error', (error) => {
      keep(`${error.message}\n`);
      finish(null, { code: 127 });
    });
    child.on('close', (code, signal) => finish(null, { code: code ?? signal }));
    child.stdin.write(`${initializeRequest(version)}\n`);
  });
}

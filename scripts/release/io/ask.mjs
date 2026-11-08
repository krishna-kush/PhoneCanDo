// A yes/no question in the terminal for the release script, which runs
// synchronously: bash's `read` waits for the line. Red when stdout is a
// terminal.
import { spawnSync } from 'node:child_process';

export const red = (text) => (process.stdout.isTTY ? `\x1b[31m${text}\x1b[0m` : text);

/** True when the terminal answers y or yes; null when there is no terminal to ask. */
export function askYes(question) {
  if (!process.stdin.isTTY) return null;
  const result = spawnSync('bash', ['-c', 'read -r -p "$1" answer && printf %s "$answer"', 'ask', question], {
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  return /^y(es)?$/i.test((result.stdout || '').trim());
}

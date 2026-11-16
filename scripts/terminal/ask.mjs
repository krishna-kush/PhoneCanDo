// A yes/no question in the terminal for our scripts (./manage, the release
// script), which run synchronously: bash's `read` waits for the line.
import { spawnSync } from 'node:child_process';

/**
 * True when the terminal answers y or yes, `empty` when it answers nothing
 * (just Enter); null when there is no terminal to ask.
 */
export function askYes(question, { empty = false } = {}) {
  if (!process.stdin.isTTY) return null;
  const result = spawnSync('bash', ['-c', 'read -r -p "$1" answer && printf %s "$answer"', 'ask', question], {
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  const answer = (result.stdout || '').trim();
  return answer ? /^y(es)?$/i.test(answer) : empty;
}

/** A "show this?" question, yes by default: true unless the terminal answers no. */
export function askShow(question) {
  return askYes(`${question} [Y/n] `, { empty: true }) !== false;
}

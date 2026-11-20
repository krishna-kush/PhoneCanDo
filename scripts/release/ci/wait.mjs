// The GitHub release's build job reaches the preflight minutes after it
// starts, and CI on the commit may still be going then. While every check
// that blocks is only unfinished, wait and read CI again; the first red one
// ends the wait at once, and so does the limit. The preflight then decides
// on what the last read said. Sleep, clock and log come in, so the tests
// never wait.

import { unfinished } from './classify.mjs';

/** True while CI blocks only on checks that have not finished. */
export const stillRunning = (ci) => ci.blocks.length > 0 && ci.blocks.every(unfinished);

/**
 * read() -> ci (classified, looked back), called again every `everyMs` while
 * stillRunning, for at most `limitMs`; returns the last ci read. A read that
 * throws (GitHub or the network down for a moment) is tried again on the
 * next tick; at the limit, or on the very first read, its error is thrown.
 */
export function waitForCi(read, { limitMs, everyMs = 60_000, sleep, now, log }) {
  const start = now();
  for (let first = true; ; first = false) {
    const waited = now() - start;
    let ci;
    try {
      ci = read();
    } catch (error) {
      if (first || waited + everyMs > limitMs) throw error;
      log(`Could not read CI (${error.message}). Trying again in ${minutes(everyMs)}.`);
      sleep(everyMs);
      continue;
    }
    if (!stillRunning(ci)) return ci;
    const names = ci.blocks.map((row) => row.name).join(', ');
    if (waited + everyMs > limitMs) {
      log(`CI still running after ${minutes(waited)}: ${names}. Not waiting any longer.`);
      return ci;
    }
    log(`CI still running (${minutes(waited)} waited): ${names}. Checking again in ${minutes(everyMs)}.`);
    sleep(everyMs);
  }
}

const minutes = (ms) => `${Math.round(ms / 60_000)} min`;

// The Chrome a render draws in: $CHROME, or the first one on the PATH, run
// in its new headless mode. With none, Remotion downloads its own headless
// shell the first time. Node only.

import { openBrowser } from '@remotion/renderer';
import { spawnSync } from 'node:child_process';

const CANDIDATES = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'];

function find(): string | null {
  if (process.env.CHROME) return process.env.CHROME;
  for (const bin of CANDIDATES) {
    const which = spawnSync('which', [bin], { encoding: 'utf8' });
    if (which.status === 0) return which.stdout.trim();
  }
  return null;
}

/** What to hand Remotion's browser options: our Chrome when there is one. */
function chrome(): { browserExecutable?: string; chromeMode?: 'chrome-for-testing' } {
  const bin = find();
  return bin ? { browserExecutable: bin, chromeMode: 'chrome-for-testing' } : {};
}

/** How many times we try something Chrome can be slow at before giving up: a busy PC can take longer than Remotion waits. */
const TRIES = 3;

/** Runs [step], again when it times out, up to TRIES times. [what] names it for the log. */
export async function patiently<T>(what: string, step: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (error) {
      if (attempt >= TRIES || !/timed out/i.test(String(error))) throw error;
      console.log(`${what} was slow; trying again (${attempt + 1} of ${TRIES})`);
    }
  }
}

/** Chrome, open and ready to draw; close it when the render is done. */
export const openChrome = (): Promise<Awaited<ReturnType<typeof openBrowser>>> => patiently('Chrome', () => openBrowser('chrome', chrome()));

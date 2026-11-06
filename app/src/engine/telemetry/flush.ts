// When the queue is sent: flushSafe is the one send gate (started, the
// first-launch notice answered, the dev switch on in debug builds), plus the
// timer that flushes every 15 minutes while the app is in the foreground.
import { currentClient } from './client';
import { flags } from './flags';
import { log } from './log';

const FLUSH_EVERY_MS = 15 * 60_000;

let interval: ReturnType<typeof setInterval> | null = null;

export async function flushSafe(): Promise<void> {
  const c = currentClient();
  if (!c || !flags.ready) return;
  // Nothing goes out before the first-launch notice was answered.
  if (!flags.noticeShown) return;
  // Debug builds send nothing unless the dev switch is on.
  if (__DEV__ && !flags.devLocal) return;
  try {
    const r = await c.flush();
    if (r && !r.ok) log.info('flush not delivered', { code: r.error.code });
  } catch {
    // flush never throws; belt and braces
  }
}

export function startInterval(): void {
  if (interval !== null) return;
  interval = setInterval(() => void flushSafe(), FLUSH_EVERY_MS);
}

export function stopInterval(): void {
  if (interval === null) return;
  clearInterval(interval);
  interval = null;
}

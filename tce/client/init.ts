// init(): loads the on/off choice, the tester flag, the install id and the
// stored queue, then folds in whatever was recorded before it finished. It
// runs once per client; every later call shares the same promise.

import { UUID_V4 } from '../core/identity.ts';
import { LIMITS } from '../core/schema/limits.ts';
import { currentId, newUuid, type ClientContext } from './context.ts';
import { capQueue, wipeLocal } from './local-data.ts';
import { describe } from './log.ts';
import { persistNow, setFlag } from './persistence.ts';
import { countItems, emptyQueue, parseQueue, pruneSessions, type QueueState } from './queue.ts';
import { findRecord } from './sessions.ts';
import { STORAGE_KEYS } from './types.ts';

async function doInit(c: ClientContext): Promise<void> {
  let storedEnabled: string | null;
  try {
    storedEnabled = await c.storage.getItem(STORAGE_KEYS.enabled);
  } catch (e) {
    // Consent unknown: stay off for this run instead of risking sending
    // against a stored "off".
    c.log.warn('telemetry: could not read the on/off setting; off for this run', { error: describe(e) });
    storedEnabled = '0';
  }
  c.enabled = storedEnabled !== '0';

  try {
    c.tester = (await c.storage.getItem(STORAGE_KEYS.tester)) === '1';
  } catch (e) {
    c.log.warn('telemetry: could not read the tester flag', { error: describe(e) });
  }

  let storedId: string | null = null;
  try {
    storedId = await c.storage.getItem(STORAGE_KEYS.installId);
  } catch (e) {
    c.log.warn('telemetry: could not read the install id', { error: describe(e) });
  }
  if (storedId && UUID_V4.test(storedId)) {
    c.install = storedId;
  } else {
    c.install = newUuid(c);
    await setFlag(c, STORAGE_KEYS.installId, c.install);
  }

  let raw: string | null = null;
  let rewrite = c.persistWanted;
  try {
    raw = await c.storage.getItem(STORAGE_KEYS.queue);
  } catch (e) {
    c.log.warn('telemetry: could not read the queue', { error: describe(e) });
  }
  const parsed = parseQueue(raw);
  let loaded: QueueState;
  let storedCurrent: string | null = null;
  if (parsed.ok) {
    loaded = parsed.value.queue;
    storedCurrent = parsed.value.current;
    if (parsed.value.skipped > 0) {
      rewrite = true;
      c.log.warn('telemetry: skipped malformed queue items', { skipped: parsed.value.skipped });
    }
  } else {
    loaded = emptyQueue();
    rewrite = true;
    c.log.warn('telemetry: persisted queue was unreadable; starting empty', { reason: parsed.error.message });
  }

  // Items recorded before init finished come after the stored ones.
  const pre = c.queue;
  const errorIds = new Set(loaded.errors.map((e) => e.errorId));
  c.queue = {
    sessions: [...loaded.sessions, ...pre.sessions],
    events: [...loaded.events, ...pre.events],
    errors: [...loaded.errors, ...pre.errors.filter((e) => !errorIds.has(e.errorId))],
  };
  const loadedRecent = loaded.events.slice(-LIMITS.reportEvents);
  c.recent = [...loadedRecent, ...c.recent].slice(-LIMITS.reportEvents);

  const before = countItems(c.queue);
  pruneSessions(c.queue, currentId(c));
  if (!c.enabled) wipeLocal(c);
  capQueue(c);
  if (countItems(c.queue) !== before) rewrite = true;
  // Only while the queue still holds it: a delivered session was pruned
  // above, and its counters can no longer be added to.
  c.previousId =
    storedCurrent !== null && storedCurrent !== currentId(c) && findRecord(c, storedCurrent) ? storedCurrent : null;

  c.ready = true;
  c.persistWanted = false;
  if (rewrite) await persistNow(c);
}

/** TceClient.init: loads flags, install id and the stored queue; resolves once, never rejects. */
export function init(c: ClientContext): Promise<void> {
  if (!c.initPromise) {
    c.initPromise = doInit(c).catch((e) => {
      // Defensive: doInit guards every port call, so this is a bug.
      c.ready = true;
      c.log.error('telemetry: init failed', { error: describe(e) });
    });
  }
  return c.initPromise;
}

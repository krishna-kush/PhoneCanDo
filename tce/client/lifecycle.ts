// The choices that change what may be sent: turning telemetry on or off,
// the tester flag and a new install id. Turning off and a new id bump the
// epoch, so a flush already running stops before its next batch, and
// nothing recorded before them travels after them.

import { newUuid, type ClientContext } from './context.ts';
import { flushIdle } from './flush.ts';
import { init } from './init.ts';
import { wipeLocal } from './local-data.ts';
import { persistNow, schedulePersist, setFlag } from './persistence.ts';
import { rotateSession } from './sessions.ts';
import { STORAGE_KEYS } from './types.ts';

/** TceClient.setEnabled: off wipes the queue and stops all sending; on starts a fresh session. */
export async function setEnabled(c: ClientContext, on: boolean): Promise<void> {
  await init(c);
  if (on === c.enabled) {
    await setFlag(c, STORAGE_KEYS.enabled, on ? '1' : '0');
    return;
  }
  if (on) {
    c.enabled = true;
    // Nothing from the off period travels: a fresh session starts now.
    // The old one, if it was ever sent, simply ends where it was.
    rotateSession(c);
    await setFlag(c, STORAGE_KEYS.enabled, '1');
    schedulePersist(c);
    return;
  }
  c.enabled = false;
  c.epoch++;
  wipeLocal(c);
  await setFlag(c, STORAGE_KEYS.enabled, '0');
  await persistNow(c);
}

/** TceClient.setTester: stores the flag and resends the current session so the device row carries it. */
export async function setTester(c: ClientContext, on: boolean): Promise<void> {
  await init(c);
  c.tester = on;
  await setFlag(c, STORAGE_KEYS.tester, on ? '1' : '0');
  // The device row carries the flag; make the next flush send one.
  if (c.enabled && c.current) {
    c.current.dirty = true;
    c.current.rev++;
    schedulePersist(c);
  }
}

/** TceClient.resetInstallId: a new random install id, with the queue cleared and the session started over. */
export async function resetInstallId(c: ClientContext): Promise<string> {
  await init(c);
  c.resetting++;
  c.epoch++;
  try {
    // A batch already on the wire finishes (or times out) under the old
    // id; nothing planned after it is sent.
    await flushIdle(c);
    c.install = newUuid(c);
    await setFlag(c, STORAGE_KEYS.installId, c.install);
    // Nothing recorded under the old id travels under the new one: the
    // queue is cleared and the session starts over.
    wipeLocal(c);
    rotateSession(c);
    await persistNow(c);
    return c.install;
  } finally {
    c.resetting--;
  }
}

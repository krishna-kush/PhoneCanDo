// Telemetry adapter, public API for screens. This folder holds the ONLY app
// files that import tce (enforced by tce/scripts/check-deps.mjs), and only
// tce/client and tce/core. Its modules supply the SDK's ports (AsyncStorage,
// fetch, expo-crypto, expo-device, expo-application, the runner's native
// counters) and own flush timing. Screens import this index, never tce and
// never a module inside this folder. Below: the user's actions.
//
// Release builds send to TELEMETRY_BASE, on by default from the first launch,
// with no prompt: Settings → Privacy shows it and turns it off. Debug builds send nothing
// unless the dev-only "Send to local dev host" switch is on; then they send
// to 127.0.0.1:8787 (`pnpm -C tce dev` + `adb reverse tcp:8787 tcp:8787`).
// Off means off: no session fields, events or errors from the off period are
// kept, and the native side is told (it skips telemetry-only work). Raw
// engine output goes only into a report the user sends. Everything here is
// fire-and-forget: a telemetry failure is logged and never reaches the caller.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTelemetrySnapshot } from '../runner';
import { getClient } from './client';
import { DEV_LOCAL_KEY, flags } from './flags';
import { flushSafe } from './flush';
import { markSessionStart } from './fold';
import { discardNative, mirrorEnabled } from './native';
import { deletedMessage, failure, NOTHING_STORED_MESSAGE, UNAVAILABLE, type TelemetryOutcome } from './outcomes';
import { emit } from './state';
import { track } from './track';

export { PRIVACY_URL, TELEMETRY_BASE } from './client';
export { startTelemetry } from './lifecycle';
export { deletedMessage, NOTHING_STORED_MESSAGE, type TelemetryOutcome };
export { getTelemetryState, subscribeTelemetry, type TelemetryState } from './state';
export { track, trackOnce } from './track';

/** Turns usage stats on or off. Off clears everything still waiting to be sent; on starts a fresh session. */
export async function setTelemetryEnabled(on: boolean): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    const was = c.isEnabled();
    await c.setEnabled(on);
    if (was !== on) {
      // What native counted so far belongs to the session that ends (off)
      // or to the off period (on): neither is ever sent.
      discardNative();
      if (on) markSessionStart();
    }
    if (on) void flushSafe();
  } finally {
    mirrorEnabled();
    emit();
  }
}

/** Marks this phone as one of our test devices (left out of user counts). */
export async function setTesterDevice(on: boolean): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.setTester(on);
  } finally {
    emit();
  }
}

/**
 * A new random install id; data not sent yet is dropped. Data already sent
 * stays linked to this phone (same device id): forgetMe() removes that.
 */
export async function resetAnonymousId(): Promise<TelemetryOutcome> {
  const c = getClient();
  if (!c) return UNAVAILABLE;
  await c.resetInstallId();
  // The new session starts with nothing counted under the old id.
  markSessionStart();
  discardNative();
  emit();
  return {
    ok: true,
    message: 'New install ID started; data not sent yet was dropped. Data already sent stays linked to this phone until you use Delete my data.',
  };
}

/** Sends a user report: the note, recent events and the engine's last crash output (redacted by the SDK). */
export async function sendReport(note: string): Promise<TelemetryOutcome> {
  const c = getClient();
  if (!c) return UNAVAILABLE;
  if (!c.isEnabled()) return { ok: false, message: 'Usage stats are off.' };
  // The only place engine output leaves the phone: a report the user chose
  // to send. Read from native (a peek), which keeps the last unexpected
  // exit's output until the next one, so it survives a process death. The
  // SDK redacts paths and secrets before it goes.
  const logTail = getTelemetrySnapshot()?.engine?.lastStderrTail ?? undefined;
  const r = await c.report({ note, logTail });
  if (!r.ok) return failure(r.error);
  track('report.sent');
  void flushSafe();
  return { ok: true, message: 'Report sent. Thank you.' };
}

/**
 * Deletes every row the server holds for this phone (all installs, by device
 * proof), then turns usage stats off and starts a new install id.
 */
export async function forgetMe(): Promise<TelemetryOutcome> {
  const c = getClient();
  if (!c) return UNAVAILABLE;
  try {
    const r = await c.forget();
    if (r.ok || r.error.code === 'not_found') {
      // Off now, with a fresh session: nothing counted before is kept.
      markSessionStart();
      discardNative();
      return { ok: true, message: r.ok ? deletedMessage(r.value) : NOTHING_STORED_MESSAGE };
    }
    return failure(r.error);
  } finally {
    mirrorEnabled();
    emit();
  }
}

/** Debug builds only: send to the local dev host (127.0.0.1:8787). No-op in release. */
export async function setDevLocal(on: boolean): Promise<void> {
  if (!__DEV__) return;
  flags.devLocal = on;
  emit();
  try {
    await AsyncStorage.setItem(DEV_LOCAL_KEY, on ? '1' : '0');
  } catch {
    // in-memory choice applies for this run
  }
  if (on) void flushSafe();
}

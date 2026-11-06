// Startup and app lifecycle: startTelemetry runs boot once (error handler,
// session start, flags from storage, client init, the boot read of native
// counters, the first flush), the AppState hook folds and flushes on
// background and runs the flush timer in the foreground, and the first
// launch on a higher versionCode records update.installed.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { getTelemetrySnapshot } from '../runner';
import { currentClient, getClient } from './client';
import { DEV_LOCAL_KEY, flags } from './flags';
import { flushSafe, startInterval, stopInterval } from './flush';
import { markSessionStart } from './fold';
import { installErrorHandler } from './jsErrors';
import { log } from './log';
import { collectAtBoot, collectNative, mirrorEnabled } from './native';
import { envPort } from './ports';
import { emit, getTelemetryState, type TelemetryState } from './state';
import { track } from './track';

// Adapter-owned: "<versionCode>|<version>" of the last launch, for update.installed.
const LAST_VERSION_KEY = 'phonecando.telemetry.lastVersion.v1';
// Off the launch path: the first frames and the engine autostart go first.
const BOOT_DELAY_MS = 1500;
const FIRST_FLUSH_MS = 10_000;

function onAppState(state: AppStateStatus): void {
  const c = currentClient();
  if (!c || !flags.ready) return;
  try {
    if (state === 'background') {
      stopInterval();
      // Folded and stored, then consumed, while on; discarded off. Ended =
      // last time seen (the server keeps the latest). Android may freeze or
      // kill a backgrounded app, so the queue is stored before the flush.
      const endedAt = Date.now();
      void collectNative(c, { endedAt }).then(flushSafe);
    } else if (state === 'active') {
      startInterval();
    }
  } catch (e) {
    log.warn('lifecycle hook failed', { error: e instanceof Error ? e.message : String(e) });
  }
}

// A finished install replaces the process before the updater can report
// it, so update.installed is the first launch on a higher versionCode
// (self-update, Play or the lite→full step alike).
async function noteVersionChange(): Promise<void> {
  try {
    const app = envPort.app();
    const stored = await AsyncStorage.getItem(LAST_VERSION_KEY);
    const [prevCode, prevVersion] = (stored ?? '').split('|');
    const prev = Number.parseInt(prevCode ?? '', 10);
    if (Number.isFinite(prev) && app.versionCode > prev) {
      track('update.installed', { from: prevVersion ?? '', to: app.version, channel: app.channel });
    }
    if (stored !== `${app.versionCode}|${app.version}`) {
      await AsyncStorage.setItem(LAST_VERSION_KEY, `${app.versionCode}|${app.version}`);
    }
  } catch {
    // best-effort
  }
}

async function boot(): Promise<TelemetryState> {
  installErrorHandler();
  // Peeked before the new session starts and before this run counts
  // anything (the engine autostart comes after startTelemetry): what native
  // holds now is the previous run's (collectAtBoot).
  const early = getClient();
  const before = early ? getTelemetrySnapshot() : null;
  // The session starts now (the SDK buffers until init), so events from the
  // first seconds belong to it instead of opening a throwaway one.
  if (early) {
    markSessionStart();
    early.startSession();
  }
  await new Promise((r) => setTimeout(r, BOOT_DELAY_MS));
  if (__DEV__) {
    try {
      flags.devLocal = (await AsyncStorage.getItem(DEV_LOCAL_KEY)) === '1';
    } catch {
      // no dev sending
    }
  }
  const c = getClient();
  if (!c) {
    mirrorEnabled();
    flags.ready = true;
    emit();
    return getTelemetryState();
  }
  await c.init();
  mirrorEnabled();
  flags.ready = true;
  emit();
  void noteVersionChange();
  // Splits what native holds between the previous run and this one; last
  // run's crashes go out early, since a crash loop never reaches the
  // background (dropped while off).
  const crashed = (before?.nativeCrashes?.length ?? 0) > 0;
  void collectAtBoot(c, before).then(() => (crashed ? flushSafe() : undefined));
  setTimeout(() => void flushSafe(), FIRST_FLUSH_MS - BOOT_DELAY_MS);
  AppState.addEventListener('change', onAppState);
  if (AppState.currentState === 'active') startInterval();
  return getTelemetryState();
}

let started: Promise<TelemetryState> | null = null;

/** Starts telemetry once, after the store hydrated. Resolves with the flags; never rejects. */
export function startTelemetry(): Promise<TelemetryState> {
  if (!started) {
    started = boot().catch((e) => {
      log.error('start failed', { error: e instanceof Error ? e.message : String(e) });
      mirrorEnabled();
      flags.ready = true;
      emit();
      return getTelemetryState();
    });
  }
  return started;
}

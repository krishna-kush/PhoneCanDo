// Engine seam: the ONLY importer of the phonecando-runner native module.
// UI code must import serve lifecycle from here, never from modules/*.
// Lazy require keeps this importable where native code is absent (Expo Go).
import type { NativeCrash, TelemetryNativeSnapshot } from '../../modules/phonecando-runner/src/telemetry.types';

export type { NativeCrash, TelemetryNativeSnapshot };

export type ServeParams = {
  binary?: string;
  port?: string;
  libDir?: string;
  sslCertFile?: string;
};

type RunnerModule = {
  getPrefix(): string;
  isServeRunning(): boolean;
  startServe(params: ServeParams): string;
  stopServe(): string;
  startServeService(params: ServeParams): string;
  stopServeService(): string;
  setActiveSession(params: { sessionId?: string; title?: string }): string;
  leaveSession(params: { sessionId?: string }): string;
  updateSessionTitle(params: { sessionId?: string; title?: string }): string;
  getServePort(): string;
  requestNotificationPermission(): string;
  health(params: { port?: string }): string;
};
function load(): RunnerModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../modules/phonecando-runner/src/PhoneCanDoRunnerModule');
  const impl = (mod?.default ?? mod) as RunnerModule | undefined;
  if (!impl || typeof impl.getPrefix !== 'function') {
    throw new Error('native runner module unavailable');
  }
  return impl;
}

export function isRunnerAvailable(): boolean {
  try {
    load();
    return true;
  } catch {
    return false;
  }
}

export function getPrefix(): string {
  return load().getPrefix();
}

export function isServeRunning(): boolean {
  return load().isServeRunning();
}

export function startServe(params: ServeParams): string {
  return load().startServe(params);
}

export function stopServe(): string {
  return load().stopServe();
}

export function startServeService(params: ServeParams): string {
  return load().startServeService(params);
}

export function stopServeService(): string {
  return load().stopServeService();
}

// Build channel: full ships phone control; lite has no phone control but
// self-updates; play has neither. Absent native fn (Expo Go / pre-channel
// installs) means full — dev default.
export function getBuildChannel(): string {
  try {
    const m = load() as unknown as { getBuildChannel?: () => string };
    if (typeof m.getBuildChannel !== 'function') return 'full';
    return m.getBuildChannel();
  } catch {
    return 'full';
  }
}

// Phone-control master switch (default off, in-memory; flips reset on app
// restart). Settings flips it after biometric auth; the agent cannot.
export function setAutomationEnabled(enabled: boolean): boolean {
  try {
    const m = load() as unknown as { setAutomationEnabled?: (v: boolean) => boolean };
    if (typeof m.setAutomationEnabled !== 'function') return false;
    return m.setAutomationEnabled(enabled);
  } catch {
    return false;
  }
}

export function isAutomationEnabled(): boolean {
  try {
    const m = load() as unknown as { isAutomationEnabled?: () => boolean };
    if (typeof m.isAutomationEnabled !== 'function') return false;
    return m.isAutomationEnabled();
  } catch {
    return false;
  }
}

// One-shot tab requested by the bridge's /app route (agent return / unlock).
export function consumeLaunchTab(): string {
  try {
    const m = load() as unknown as { consumeLaunchTab?: () => string };
    if (typeof m.consumeLaunchTab !== 'function') return '';
    return m.consumeLaunchTab();
  } catch {
    return '';
  }
}

// Native event for a tab switch while the app is already foreground (no
// AppState transition fires in that case).
export function onLaunchTab(listener: (tab: string) => void): { remove(): void } {
  try {
    const m = load() as unknown as {
      addListener?: (name: string, cb: (e: { tab?: string }) => void) => { remove(): void };
    };
    if (typeof m.addListener !== 'function') return { remove() {} };
    return m.addListener('phonecandoLaunchTab', (e) => listener(e?.tab ?? ''));
  } catch {
    return { remove() {} };
  }
}

// One-shot biometric request from the bridge's /unlock route.
export function consumeUnlockRequest(): string {
  try {
    const m = load() as unknown as { consumeUnlockRequest?: () => string };
    if (typeof m.consumeUnlockRequest !== 'function') return '';
    return m.consumeUnlockRequest();
  } catch {
    return '';
  }
}

export function onUnlockRequest(listener: (reason: string) => void): { remove(): void } {
  try {
    const m = load() as unknown as {
      addListener?: (name: string, cb: (e: { reason?: string }) => void) => { remove(): void };
    };
    if (typeof m.addListener !== 'function') return { remove() {} };
    return m.addListener('phonecandoUnlockRequest', (e) => listener(e?.reason ?? ''));
  } catch {
    return { remove() {} };
  }
}

// Resolve the bridge's waiting /unlock request after biometrics/cancel.
export function resolveUnlock(ok: boolean): boolean {
  try {
    const m = load() as unknown as { resolveUnlock?: (v: boolean) => boolean };
    if (typeof m.resolveUnlock !== 'function') return false;
    return m.resolveUnlock(ok);
  } catch {
    return false;
  }
}

export function consumeAccessibilityRequest(): string {
  try {
    const m = load() as unknown as { consumeAccessibilityRequest?: () => string };
    if (typeof m.consumeAccessibilityRequest !== 'function') return '';
    return m.consumeAccessibilityRequest();
  } catch {
    return '';
  }
}

export function onAccessibilityRequest(listener: (reason: string) => void): { remove(): void } {
  try {
    const m = load() as unknown as {
      addListener?: (name: string, cb: (e: { reason?: string }) => void) => { remove(): void };
    };
    if (typeof m.addListener !== 'function') return { remove() {} };
    return m.addListener('phonecandoAccessibilityRequest', (e) => listener(e?.reason ?? ''));
  } catch {
    return { remove() {} };
  }
}

// Resolve the bridge's waiting /accessibility request after the user confirms
// (or cancels) the in-chat prompt. `guided`: the restricted-settings guide is
// running, so the bridge answers at once instead of waiting for the service.
export function resolveAccessibility(ok: boolean, guided: boolean): boolean {
  try {
    const m = load() as unknown as { resolveAccessibility?: (v: boolean, g: boolean) => boolean };
    if (typeof m.resolveAccessibility !== 'function') return false;
    return m.resolveAccessibility(ok, guided);
  } catch {
    return false;
  }
}

export function isUiAutomationConnected(): boolean {
  try {
    const m = load() as unknown as { isUiAutomationConnected?: () => boolean };
    if (typeof m.isUiAutomationConnected !== 'function') return false;
    return m.isUiAutomationConnected();
  } catch {
    return false;
  }
}

// PhoneCanDo is in Android's enabled accessibility services (set by the
// switch, before the service binds).
export function isAccessibilityServiceEnabled(): boolean {
  try {
    const m = load() as unknown as { isAccessibilityServiceEnabled?: () => boolean };
    return typeof m.isAccessibilityServiceEnabled === 'function' && m.isAccessibilityServiceEnabled();
  } catch {
    return false;
  }
}

// The service ran on this install, which proves the restricted-settings lock
// was cleared (RestrictedSettings.kt).
export function hasAccessibilityConnectedBefore(): boolean {
  try {
    const m = load() as unknown as { hasAccessibilityConnectedBefore?: () => boolean };
    return typeof m.hasAccessibilityConnectedBefore === 'function' && m.hasAccessibilityConnectedBefore();
  } catch {
    return false;
  }
}

// Android lets PhoneCanDo install APKs ("Install unknown apps" for this
// app). True when the native call is missing, so the old flow still runs.
export function canRequestPackageInstalls(): boolean {
  try {
    const m = load() as unknown as { canRequestPackageInstalls?: () => boolean };
    return typeof m.canRequestPackageInstalls !== 'function' || m.canRequestPackageInstalls();
  } catch {
    return true;
  }
}

// Marks the coming APK replace as PhoneCanDo's own self-update, so the update
// receiver in the new build announces it; updates PhoneCanDo did not start
// (Play, adb, dev reinstalls) stay quiet. False when the native fn is missing
// or the write failed; the installer's own Open button still leads back.
export function markSelfUpdatePending(): boolean {
  try {
    const m = load() as unknown as { markSelfUpdatePending?: () => boolean };
    if (typeof m.markSelfUpdatePending !== 'function') return false;
    return m.markSelfUpdatePending();
  } catch {
    return false;
  }
}

// Android 14+: PhoneCanDo can show Android's "Restricted setting" note
// itself, so the user never has to find PhoneCanDo in the Accessibility list.
// False on Android 13 or when the OEM guards that activity.
export function canShowRestrictedSettingNote(): boolean {
  try {
    const m = load() as unknown as { canShowRestrictedSettingNote?: () => boolean };
    return typeof m.canShowRestrictedSettingNote === 'function' && m.canShowRestrictedSettingNote();
  } catch {
    return false;
  }
}

// Shows Android's "Restricted setting" note over the app. 'opened' | 'failed'.
export function showRestrictedSettingNote(): string {
  try {
    const m = load() as unknown as { showRestrictedSettingNote?: () => string };
    if (typeof m.showRestrictedSettingNote !== 'function') return 'failed';
    return m.showRestrictedSettingNote();
  } catch {
    return 'failed';
  }
}

// Opens this app's App info page, where the ⋮ menu holds "Allow restricted
// settings" once Android has shown its note. 'opened' | 'failed'.
export function openAppInfoSettings(): string {
  try {
    const m = load() as unknown as { openAppInfoSettings?: () => string };
    if (typeof m.openAppInfoSettings !== 'function') return 'failed';
    return m.openAppInfoSettings();
  } catch {
    return 'failed';
  }
}

export function openAccessibilitySettings(): string {
  try {
    const m = load() as unknown as { openAccessibilitySettings?: () => string };
    if (typeof m.openAccessibilitySettings !== 'function') return 'unsupported';
    return m.openAccessibilitySettings();
  } catch {
    return 'unsupported';
  }
}

// Effective port the service settled on ("" when never started yet —
// pre-rebuild installs lack this function, callers must tolerate that).
export function getServePort(): string {
  return load().getServePort();
}

// v2 random server password ("" until the service captures it from serve.log).
// Every serve REST/SSE call needs it as HTTP Basic (user `opencode`).
export function getServePassword(): string {
  try {
    const m = load() as unknown as { getServePassword?: () => string };
    if (typeof m.getServePassword !== 'function') return '';
    return m.getServePassword();
  } catch {
    return '';
  }
}

// System notification grant (Android 13+). Pre-rebuild installs lack it —
// callers must tolerate the throw, same as the other post-rebuild fns.
export function requestNotificationPermission(): string {
  return load().requestNotificationPermission();
}

export function serveHealth(port: string): string {
  return load().health({ port });
}

export function engineBaseUrl(port: string): string {
  return `http://127.0.0.1:${port}`;
}

// Telemetry counters (contract: modules/phonecando-runner/src/telemetry.types.ts).
// These go through the module file's own exports (which already guard a
// missing native method), not the raw native object load() returns.
// Typed from the module file itself, so a changed signature fails tsc here;
// Partial because an older bundle may lack an export.
type TelemetryExports = Partial<
  Pick<
    typeof import('../../modules/phonecando-runner/src/PhoneCanDoRunnerModule'),
    'getTelemetrySnapshot' | 'consumeTelemetrySnapshot' | 'setTelemetryEnabled'
  >
>;

function loadTelemetryExports(): TelemetryExports | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../modules/phonecando-runner/src/PhoneCanDoRunnerModule') as TelemetryExports;
  } catch {
    return null;
  }
}

// Read-only peek at the native counters and state. Null when unavailable.
export function getTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  try {
    const m = loadTelemetryExports();
    return typeof m?.getTelemetrySnapshot === 'function' ? (m.getTelemetrySnapshot() ?? null) : null;
  } catch {
    return null;
  }
}

// Same shape, but zeroes the counters, clears the last exit and boot and
// drains native crashes, so each is returned once; the last stderr tail
// stays until the next unexpected exit. Call it only after what a peek
// returned is folded and stored. Null when unavailable.
export function consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  try {
    const m = loadTelemetryExports();
    return typeof m?.consumeTelemetrySnapshot === 'function' ? (m.consumeTelemetrySnapshot() ?? null) : null;
  } catch {
    return null;
  }
}

// Mirrors the user's usage-stats on/off choice into native prefs, so the
// serve service skips telemetry-only work while off. Native defaults to on
// and ignores a repeated value; a no-op on builds without the method.
export function setTelemetryEnabled(enabled: boolean): void {
  try {
    const m = loadTelemetryExports();
    if (typeof m?.setTelemetryEnabled === 'function') m.setTelemetryEnabled(enabled);
  } catch {
    // telemetry must never break the app
  }
}

// Container path canonicalization: /data/data/<pkg>/... and
// /data/user/0/<pkg>/... are the same directory (owner-user bind), but the
// server hashes the raw string for project ids — mixed spellings fork one
// folder into duplicate project rows. Normalize outbound session/TUI
// directories to the /data/user/0 spelling (what the server resolves to).
export function canonicalizeContainerPath(p: string): string {
  const m = /^\/data\/data\/([^/]+)\/(.*)$/.exec(p);
  return m ? `/data/user/0/${m[1]}/${m[2]}` : p;
}

// Engine seam: the ONLY importer of the phonecando-runner native module
// (engines.ts reaches it through nativeRunner()). UI code imports from here
// or engines.ts, never from modules/*. Lazy require keeps this importable
// where native code is absent (Expo Go, web).
import type {
  NativeAgent,
  NativeBridgePrompt,
  NativeEngineAuth,
  NativeEngineStatus,
  NativeLaunchTarget,
} from '../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import type { NativeCrash, TelemetryNativeSnapshot } from '../../modules/phonecando-runner/src/telemetry.types';
import type { AgentId } from './agents/records';

export type { NativeCrash, TelemetryNativeSnapshot };

type Sub = { remove(): void };

export type RunnerModule = {
  getPrefix(): string;
  requestNotificationPermission(): string;
  listAgents(): NativeAgent[];
  createAgent(params: { kind: string; name: string; imageId: string }): NativeAgent;
  renameAgent(id: string, name: string): NativeAgent;
  deleteAgent(id: string): Promise<boolean>;
  startEngine(agentId: string): Promise<{ port: string }>;
  stopEngine(agentId: string): Promise<void>;
  stopAllEngines(): Promise<void>;
  isAnyEngineAlive(): boolean;
  touchEngine(agentId: string): void;
  dismissAgentAlert(agentId: string): void;
  setOpenChat(agentId: string | null, sessionId: string | null, title: string | null): void;
  engineStatus(agentId: string): NativeEngineStatus;
  engineStatuses(): NativeEngineStatus[];
  getEngineAuth(agentId: string): NativeEngineAuth;
  engineHealth(agentId: string): string;
  pendingPrompts(): NativeBridgePrompt[];
  resolveUnlock(requestId: string, ok: boolean): boolean;
  resolveAccessibility(requestId: string, ok: boolean, guided: boolean): boolean;
  consumeLaunchTarget(): NativeLaunchTarget | null;
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

/** The raw native module, for the engine seam's own files. Throws when absent. */
export function nativeRunner(): RunnerModule {
  return load();
}

/** A native event as a typed subscription; a no-op where the module is absent. */
export function onRunnerEvent<T>(name: string, listener: (e: T) => void): Sub {
  try {
    const m = load() as unknown as { addListener?: (n: string, cb: (e: T) => void) => Sub };
    if (typeof m.addListener !== 'function') return { remove() {} };
    return m.addListener(name, listener);
  } catch {
    return { remove() {} };
  }
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

// Where the app should land: a footer tab and, when the reason is one agent
// (a tap on its notification or alert, its return after phone control, its
// prompt), that agent. Native binds it when the app opens, so each
// notification opens its own agent.
export type LaunchTarget = { tab: NativeLaunchTarget['tab']; agentId: AgentId | null };

const LAUNCH_TABS: readonly string[] = ['home', 'env', 'settings'];

function asLaunchTarget(raw: NativeLaunchTarget | null | undefined): LaunchTarget | null {
  if (!raw || !LAUNCH_TABS.includes(raw.tab)) return null;
  return { tab: raw.tab, agentId: raw.agentId || null };
}

// The target waiting for the app (a cold or resumed start), read and
// cleared once; null when nothing waits.
export function consumeLaunchTarget(): LaunchTarget | null {
  try {
    return asLaunchTarget(load().consumeLaunchTarget());
  } catch {
    return null;
  }
}

// A target while JS runs (no AppState transition fires when the app is
// already in front).
export function onLaunchTarget(listener: (target: LaunchTarget) => void): Sub {
  return onRunnerEvent<NativeLaunchTarget>('phonecandoLaunchTarget', (e) => {
    const target = asLaunchTarget(e);
    if (target) listener(target);
  });
}

// A prompt an agent is waiting on: biometric unlock for phone control, or
// accessibility setup. One per asking request, each with its own requestId.
export type BridgePrompt = {
  requestId: string;
  kind: 'unlock' | 'accessibility';
  agentId: AgentId;
  agentName: string;
  reason: string;
};

/** Every prompt still waiting (made while the app was closed, too). */
export function pendingPrompts(): BridgePrompt[] {
  try {
    return load().pendingPrompts();
  } catch {
    return [];
  }
}

/** A new prompt while the app runs; pendingPrompts covers the rest. */
export function onBridgePrompt(listener: (prompt: BridgePrompt) => void): Sub {
  return onRunnerEvent<BridgePrompt>('phonecandoBridgePrompt', listener);
}

// The user's answer to one unlock prompt (biometrics passed, or "Not now").
export function resolveUnlock(requestId: string, ok: boolean): boolean {
  try {
    return load().resolveUnlock(requestId, ok);
  } catch {
    return false;
  }
}

// Progress on one accessibility prompt: ok when the user opened a step's
// screen, not ok for "Not now" (which ends that request's wait). `guided`:
// the restricted-settings guide is running; the bridge keeps waiting for the
// service and only reports `restricted: sideload` to the agent.
export function resolveAccessibility(requestId: string, ok: boolean, guided: boolean): boolean {
  try {
    return load().resolveAccessibility(requestId, ok, guided);
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

// System notification grant (Android 13+). Pre-rebuild installs lack it —
// callers must tolerate the throw, same as the other post-rebuild fns.
export function requestNotificationPermission(): string {
  return load().requestNotificationPermission();
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
// engines skip telemetry-only work while off. Native defaults to on
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

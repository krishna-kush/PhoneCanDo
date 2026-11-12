import { NativeModule, requireNativeModule } from 'expo';

import type {
  NativeAgent,
  NativeBridgePrompt,
  NativeClientRecipe,
  NativeEngineStatus,
  NativeInstallPlan,
  NativeKindDeleted,
  NativeKindProblem,
  NativeKindSaved,
  NativeLaunchTarget,
  NativeMemoryStatus,
  NativeOpenUrlAction,
  NativePromptReading,
  NativeRunLimits,
  NativeTerminalAttach,
  NativeTerminalTheme,
  NativeUserKind,
  NativeVersionCheck,
} from './PhoneCanDoRunner.types';
import type { TelemetryNativeSnapshot } from './telemetry.types';

export type { EngineHealth, NativeCrash, TelemetryNativeSnapshot } from './telemetry.types';
export type {
  NativeAgent,
  NativeAutoStop,
  NativeBridgePrompt,
  NativeClientRecipe,
  NativeEngineStatus,
  NativeInstallPlan,
  NativeKindDeleted,
  NativeKindProblem,
  NativeKindSaved,
  NativeLaunchTarget,
  NativeMemoryAgent,
  NativeMemoryLevel,
  NativeMemoryModel,
  NativeMemoryStatus,
  NativeOpenUrlAction,
  NativePromptReading,
  NativeRunLimits,
  NativeTerminalAttach,
  NativeTerminalTheme,
  NativeUserKind,
  NativeVersionCheck,
} from './PhoneCanDoRunner.types';

type RunnerEvents = {
  phonecandoLaunchTarget(e: NativeLaunchTarget): void;
  phonecandoBridgePrompt(e: NativeBridgePrompt): void;
  phonecandoEngineState(e: NativeEngineStatus): void;
  phonecandoPromptReading(e: { reading: NativePromptReading | null }): void;
  phonecandoMemory(e: NativeMemoryStatus): void;
};

declare class PhoneCanDoRunnerModule extends NativeModule<RunnerEvents> {
  getPrefix(): string;
  getBuildChannel(): string;
  setAutomationEnabled(enabled: boolean): boolean;
  isAutomationEnabled(): boolean;
  consumeLaunchTarget(): NativeLaunchTarget | null;
  dismissAgentAlert(agentId: string): void;
  setOpenChat(agentId: string | null, sessionId: string | null, title: string | null): void;
  pendingPrompts(): NativeBridgePrompt[];
  resolveUnlock(requestId: string, ok: boolean): boolean;
  resolveAccessibility(requestId: string, ok: boolean, guided: boolean): boolean;
  resolveOpenUrl(requestId: string, action: NativeOpenUrlAction): boolean;
  isUiAutomationConnected(): boolean;
  openAccessibilitySettings(): string;
  isAccessibilityServiceEnabled(): boolean;
  hasAccessibilityConnectedBefore(): boolean;
  canRequestPackageInstalls(): boolean;
  markSelfUpdatePending(): boolean;
  canShowRestrictedSettingNote(): boolean;
  showRestrictedSettingNote(): string;
  openAppInfoSettings(): string;
  requestNotificationPermission(): string;
  listAgents(): NativeAgent[];
  /** Throws kind_cannot_share when the machine has an agent of a kind that cannot keep a second agent's state apart. */
  createAgent(params: { kind: string; name: string; imageId: string }): NativeAgent;
  renameAgent(id: string, name: string): NativeAgent;
  deleteAgent(id: string): Promise<boolean>;
  promptReading(): NativePromptReading | null;
  startEngine(agentId: string): Promise<{ port: string | null }>;
  stopEngine(agentId: string): Promise<void>;
  stopAllEngines(): Promise<void>;
  /** Stops the agents on the model first, then its server; resolves with the agents it stopped. */
  stopModel(modelId: string): Promise<string[]>;
  runLimits(): NativeRunLimits;
  /** Saves the caps (null: none) and returns them as kept. */
  setRunLimits(limits: NativeRunLimits): NativeRunLimits;
  memoryStatus(): NativeMemoryStatus;
  isAnyEngineAlive(): boolean;
  touchEngine(agentId: string): void;
  engineStatus(agentId: string): NativeEngineStatus;
  engineStatuses(): NativeEngineStatus[];
  engineHealth(agentId: string): string;
  listKinds(): string;
  listUserKinds(): NativeUserKind[];
  readUserKind(id: string): string | null;
  validateUserKind(json: string): NativeKindProblem[];
  saveUserKind(json: string, replace: boolean): NativeKindSaved;
  deleteUserKind(id: string): NativeKindDeleted;
  copyText(text: string): boolean;
  clipboardText(): string | null;
  pairWebUi(agentId: string): Promise<string>;
  clientRecipe(agentId: string, projectDir: string, sessionId: string | null): NativeClientRecipe;
  isEngineIdle(agentId: string): boolean;
  /** What the agent's machine keeps from its guests: the same for every agent on it. */
  guestUnset(agentId: string): string[];
  installPlan(agentId: string, family: string): NativeInstallPlan | null;
  updatePlan(agentId: string, family: string): NativeInstallPlan | null;
  versionCheck(agentId: string): NativeVersionCheck | null;
  recordInstall(agentId: string, versionOutput: string): { version: string };
  engineTerminalAttach(agentId: string): NativeTerminalAttach;
  engineTerminalRead(viewerId: string, max: number): string | null;
  engineTerminalWrite(viewerId: string, b64: string): void;
  engineTerminalResize(viewerId: string, rows: number, cols: number): void;
  engineTerminalFocus(viewerId: string, shown: boolean): void;
  engineTerminalDetach(viewerId: string): void;
  engineTerminalTheme(theme: NativeTerminalTheme): boolean;
  getTelemetrySnapshot(): TelemetryNativeSnapshot | null;
  consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null;
  setTelemetryEnabled(enabled: boolean): void;
}

const mod = requireNativeModule<PhoneCanDoRunnerModule>('PhoneCanDoRunner');

export function getPrefix(): string {
  return mod.getPrefix();
}

export function getBuildChannel(): string {
  const m = mod as unknown as { getBuildChannel?: () => string };
  if (typeof m.getBuildChannel !== 'function') return 'full';
  return m.getBuildChannel();
}

export function setAutomationEnabled(enabled: boolean): boolean {
  const m = mod as unknown as { setAutomationEnabled?: (v: boolean) => boolean };
  if (typeof m.setAutomationEnabled !== 'function') return false;
  return m.setAutomationEnabled(enabled);
}

export function isAutomationEnabled(): boolean {
  const m = mod as unknown as { isAutomationEnabled?: () => boolean };
  if (typeof m.isAutomationEnabled !== 'function') return false;
  return m.isAutomationEnabled();
}

// Where the app should land, once ({tab, agentId}); null when nothing waits.
export function consumeLaunchTarget(): NativeLaunchTarget | null {
  return mod.consumeLaunchTarget() ?? null;
}

export function isUiAutomationConnected(): boolean {
  const m = mod as unknown as { isUiAutomationConnected?: () => boolean };
  if (typeof m.isUiAutomationConnected !== 'function') return false;
  return m.isUiAutomationConnected();
}

export function openAccessibilitySettings(): string {
  const m = mod as unknown as { openAccessibilitySettings?: () => string };
  if (typeof m.openAccessibilitySettings !== 'function') return 'unsupported';
  return m.openAccessibilitySettings();
}

export function markSelfUpdatePending(): boolean {
  const m = mod as unknown as { markSelfUpdatePending?: () => boolean };
  if (typeof m.markSelfUpdatePending !== 'function') return false;
  return m.markSelfUpdatePending();
}

export function requestNotificationPermission(): string {
  return mod.requestNotificationPermission();
}

// Telemetry counters (contract: telemetry.types.ts). Null when the native
// method is missing (a build before telemetry) or fails: telemetry must never
// break its caller.
export function getTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  const m = mod as unknown as { getTelemetrySnapshot?: () => TelemetryNativeSnapshot | null };
  if (typeof m.getTelemetrySnapshot !== 'function') return null;
  try {
    return m.getTelemetrySnapshot() ?? null;
  } catch {
    return null;
  }
}

// Same shape; also zeroes the native counters, clears lastExitCode,
// lastDiedAt and lastBootMs and drains the crash list, so each is returned
// once. lastStderrTail stays until the next unexpected exit replaces it.
// Callers peek, fold and store first, and consume last (telemetry.types.ts).
export function consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null {
  const m = mod as unknown as { consumeTelemetrySnapshot?: () => TelemetryNativeSnapshot | null };
  if (typeof m.consumeTelemetrySnapshot !== 'function') return null;
  try {
    return m.consumeTelemetrySnapshot() ?? null;
  } catch {
    return null;
  }
}

// Mirrors the user's telemetry on/off choice into native prefs. While off,
// no engine event stream is opened just to count sessions. No-op when the
// native method is missing or fails.
export function setTelemetryEnabled(enabled: boolean): void {
  const m = mod as unknown as { setTelemetryEnabled?: (v: boolean) => void };
  if (typeof m.setTelemetryEnabled !== 'function') return;
  try {
    m.setTelemetryEnabled(enabled);
  } catch {
    // Telemetry must never break its caller.
  }
}

export default mod;

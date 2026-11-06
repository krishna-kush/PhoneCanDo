import { NativeModule, requireNativeModule } from 'expo';

import type { TelemetryNativeSnapshot } from './telemetry.types';

export type { EngineHealth, NativeCrash, TelemetryNativeSnapshot } from './telemetry.types';

export type ServeParams = {
  binary?: string;
  port?: string;
  libDir?: string;
  sslCertFile?: string;
};

declare class PhoneCanDoRunnerModule extends NativeModule {
  getPrefix(): string;
  isServeRunning(): boolean;
  getBuildChannel(): string;
  setAutomationEnabled(enabled: boolean): boolean;
  isAutomationEnabled(): boolean;
  consumeLaunchTab(): string;
  consumeUnlockRequest(): string;
  resolveUnlock(ok: boolean): boolean;
  consumeAccessibilityRequest(): string;
  resolveAccessibility(ok: boolean, guided: boolean): boolean;
  isUiAutomationConnected(): boolean;
  openAccessibilitySettings(): string;
  isAccessibilityServiceEnabled(): boolean;
  hasAccessibilityConnectedBefore(): boolean;
  canRequestPackageInstalls(): boolean;
  markSelfUpdatePending(): boolean;
  canShowRestrictedSettingNote(): boolean;
  showRestrictedSettingNote(): string;
  openAppInfoSettings(): string;
  startServe(params: ServeParams): string;
  stopServe(): string;
  startServeService(params: ServeParams): string;
  stopServeService(): string;
  setActiveSession(params: { sessionId?: string; title?: string }): string;
  leaveSession(params: { sessionId?: string }): string;
  updateSessionTitle(params: { sessionId?: string; title?: string }): string;
  getServePort(): string;
  getServePassword(): string;
  requestNotificationPermission(): string;
  health(params: { port?: string }): string;
  getTelemetrySnapshot(): TelemetryNativeSnapshot | null;
  consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null;
  setTelemetryEnabled(enabled: boolean): void;
}

const mod = requireNativeModule<PhoneCanDoRunnerModule>('PhoneCanDoRunner');

export function getPrefix(): string {
  return mod.getPrefix();
}

export function isServeRunning(): boolean {
  return mod.isServeRunning();
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

export function consumeLaunchTab(): string {
  const m = mod as unknown as { consumeLaunchTab?: () => string };
  if (typeof m.consumeLaunchTab !== 'function') return '';
  return m.consumeLaunchTab();
}

export function consumeUnlockRequest(): string {
  const m = mod as unknown as { consumeUnlockRequest?: () => string };
  if (typeof m.consumeUnlockRequest !== 'function') return '';
  return m.consumeUnlockRequest();
}

export function resolveUnlock(ok: boolean): boolean {
  const m = mod as unknown as { resolveUnlock?: (v: boolean) => boolean };
  if (typeof m.resolveUnlock !== 'function') return false;
  return m.resolveUnlock(ok);
}

export function consumeAccessibilityRequest(): string {
  const m = mod as unknown as { consumeAccessibilityRequest?: () => string };
  if (typeof m.consumeAccessibilityRequest !== 'function') return '';
  return m.consumeAccessibilityRequest();
}

export function resolveAccessibility(ok: boolean, guided: boolean): boolean {
  const m = mod as unknown as { resolveAccessibility?: (v: boolean, g: boolean) => boolean };
  if (typeof m.resolveAccessibility !== 'function') return false;
  return m.resolveAccessibility(ok, guided);
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

export function startServe(params: ServeParams): string {
  return mod.startServe(params);
}

export function stopServe(): string {
  return mod.stopServe();
}

export function startServeService(params: ServeParams): string {
  return mod.startServeService(params);
}

export function stopServeService(): string {
  return mod.stopServeService();
}

export function setActiveSession(params: { sessionId?: string; title?: string }): string {
  return mod.setActiveSession(params);
}

export function leaveSession(params: { sessionId?: string }): string {
  return mod.leaveSession(params);
}

export function updateSessionTitle(params: { sessionId?: string; title?: string }): string {
  return mod.updateSessionTitle(params);
}

export function getServePort(): string {
  return mod.getServePort();
}

export function getServePassword(): string {
  const m = mod as unknown as { getServePassword?: () => string };
  if (typeof m.getServePassword !== 'function') return '';
  return m.getServePassword();
}

export function requestNotificationPermission(): string {
  return mod.requestNotificationPermission();
}

export function serveHealth(port = '4097'): string {
  return mod.health({ port });
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
// the serve service no longer opens the engine event stream just to count
// sessions. No-op when the native method is missing or fails.
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

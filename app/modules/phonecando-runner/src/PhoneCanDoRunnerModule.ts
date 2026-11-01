import { NativeModule, requireNativeModule } from 'expo';

export type ServeParams = {
  binary?: string;
  port?: string;
  libDir?: string;
  sslCertFile?: string;
};

declare class PhoneCanDoRunnerModule extends NativeModule {
  getPrefix(): string;
  isServeRunning(): boolean;
  isAutomationBuild(): string;
  setAutomationEnabled(enabled: boolean): boolean;
  isAutomationEnabled(): boolean;
  consumeLaunchTab(): string;
  consumeUnlockRequest(): string;
  resolveUnlock(ok: boolean): boolean;
  consumeAccessibilityRequest(): string;
  resolveAccessibility(ok: boolean): boolean;
  isUiAutomationConnected(): boolean;
  openAccessibilitySettings(): string;
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
}

const mod = requireNativeModule<PhoneCanDoRunnerModule>('PhoneCanDoRunner');

export function getPrefix(): string {
  return mod.getPrefix();
}

export function isServeRunning(): boolean {
  return mod.isServeRunning();
}

export function isAutomationBuild(): string {
  const m = mod as unknown as { isAutomationBuild?: () => string };
  if (typeof m.isAutomationBuild !== 'function') return 'full';
  return m.isAutomationBuild();
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

export function resolveAccessibility(ok: boolean): boolean {
  const m = mod as unknown as { resolveAccessibility?: (v: boolean) => boolean };
  if (typeof m.resolveAccessibility !== 'function') return false;
  return m.resolveAccessibility(ok);
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

export default mod;

// Shapes the native module returns (Kotlin: api/AgentFunctions.kt,
// api/EngineFunctions.kt, bridge/BridgePrompts.kt, notify/LaunchTarget.kt).
// The app reads them through app/src/engine/, which types them as its own
// records.
export type { EngineHealth, NativeCrash, TelemetryNativeSnapshot } from './telemetry.types';

export type NativeAgent = {
  id: string;
  kind: string;
  name: string;
  imageId: string;
  createdAt: number;
};

export type NativeEngineStatus = {
  agentId: string;
  state: 'stopped' | 'starting' | 'ready' | 'stopping' | 'died' | 'failed';
  port: string | null;
  error: string | null;
  lastUsedAt: number | null;
};

export type NativeEngineAuth = { baseUrl: string; password: string };

export type NativeBridgePrompt = {
  requestId: string;
  kind: 'unlock' | 'accessibility';
  agentId: string;
  agentName: string;
  reason: string;
};

/** Where opening the app should land: a tab and, when the reason is one agent, that agent. */
export type NativeLaunchTarget = {
  tab: 'home' | 'env' | 'settings';
  agentId: string | null;
};

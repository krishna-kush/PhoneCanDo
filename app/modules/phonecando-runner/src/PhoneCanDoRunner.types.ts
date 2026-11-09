// Shapes the native module returns (Kotlin: api/AgentFunctions.kt,
// api/EngineFunctions.kt, api/InstallFunctions.kt, bridge/BridgePrompts.kt,
// prompts/OpenUrlRegistry.kt, notify/LaunchTarget.kt).
// The app reads them through app/src/engine/, which types them as its own
// records.
export type { EngineHealth, NativeCrash, TelemetryNativeSnapshot } from './telemetry.types';

export type NativeAgent = {
  id: string;
  kind: string;
  name: string;
  imageId: string;
  createdAt: number;
  /** What its kind's install put in its machine (recordInstall); null before that. */
  installedVersion: string | null;
  /** Its kind installs into the machine and no install is recorded: startEngine refuses with agent_not_installed. */
  needsInstall: boolean;
};

/** An install or update script rendered for one agent and package family; it prints `@phase <name>` before each of `phases`. */
export type NativeInstallPlan = { script: string; timeoutSec: number; phases: string[] };

/** The kind's version check: argv to run in the machine (its runtimes on PATH) and the pattern whose group 1 is the version. */
export type NativeVersionCheck = { argv: string[]; pattern: string };

export type NativeEngineStatus = {
  agentId: string;
  state: 'stopped' | 'starting' | 'ready' | 'stopping' | 'died' | 'failed';
  port: string | null;
  error: string | null;
  lastUsedAt: number | null;
};

/** The kind's TUI attached to an agent's engine, rendered natively from its manifest. */
export type NativeClientRecipe = { cmd: string[]; env: Record<string, string>; cwd: string };

/** A viewer attached to a TUI-style engine's PTY, and that PTY's size now (the replay is drawn at it). */
export type NativeTerminalAttach = { viewerId: string; rows: number; cols: number };

export type NativeBridgePrompt = {
  requestId: string;
  kind: 'unlock' | 'accessibility' | 'open_url';
  agentId: string;
  agentName: string;
  reason: string;
  /** An open_url prompt's link (http or https, at most 2 KiB); absent for the others. */
  url?: string;
};

/** What the user did with an open_url prompt: opened it, had native copy it, or Not now. */
export type NativeOpenUrlAction = 'open' | 'copy' | 'dismiss';

/** Where opening the app should land: a tab and, when the reason is one agent, that agent. */
export type NativeLaunchTarget = {
  tab: 'home' | 'env' | 'settings';
  agentId: string | null;
};

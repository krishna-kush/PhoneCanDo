// Shapes the native module returns (Kotlin: api/AgentFunctions.kt,
// api/EngineFunctions.kt, api/InstallFunctions.kt, api/UserKindFunctions.kt, bridge/BridgePrompts.kt,
// prompts/OpenUrlRegistry.kt, notify/LaunchTarget.kt).
// The app reads them through app/src/engine/, which types them as its own
// records.
export type { EngineHealth, NativeCrash, TelemetryNativeSnapshot } from './telemetry.types';

export type NativeAgent = {
  id: string;
  kind: string;
  name: string;
  imageId: string;
  /** Its work folder, projects/ in its image's home/ (host path); its engine starts there. */
  projectDir: string;
  createdAt: number;
  /** What its kind's install put in its machine (recordInstall); null before that. */
  installedVersion: string | null;
  /** Its kind installs into the machine and no install is recorded: startEngine refuses with agent_not_installed. */
  needsInstall: boolean;
  /** The local model it runs on (a model id of the models module); null: its own setup. */
  model: string | null;
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

/** The model server reading a prompt for agents bound to it with a run going (models/prompt/PromptReading.kt). */
export type NativePromptReading = {
  modelId: string;
  modelName: string;
  agentIds: string[];
  /** New prompt tokens read so far; the total is not known while it reads. */
  read: number;
  /** Tokens its prompt cache already held. */
  cached: number;
};

/** The kind's TUI attached to an agent's engine, rendered natively from its manifest. */
export type NativeClientRecipe = { cmd: string[]; env: Record<string, string>; cwd: string };

/** A viewer attached to a TUI-style engine's PTY, and that PTY's size now (the replay is drawn at it). */
export type NativeTerminalAttach = { viewerId: string; rows: number; cols: number };

/**
 * The app's terminal theme for the TUI engines' terminals (engineTerminalTheme):
 * dark or light, and the colours they answer queries with, each `#rrggbb`
 * (`ansi`: the 16 ANSI colours, black to bright white).
 */
export type NativeTerminalTheme = {
  dark: boolean;
  foreground: string;
  background: string;
  cursor: string;
  ansi: string[];
};

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

/** Why a user kind's JSON would not load: the JSON pointer of the value ('' for the whole file) and what is wrong. */
export type NativeKindProblem = { path: string; detail: string };

/** One file in the user's kinds folder: its id (from its name), its label, why it does not load (null: it does). */
export type NativeUserKind = { id: string; label: string | null; problem: NativeKindProblem | null };

/** A save: the kind's id, or null and the problems that kept it from being written. */
export type NativeKindSaved = { id: string | null; problems: NativeKindProblem[] };

/** A delete: whether a kind was removed; usedBy names the agents of it, which keep it. */
export type NativeKindDeleted = { deleted: boolean; usedBy: string[] };

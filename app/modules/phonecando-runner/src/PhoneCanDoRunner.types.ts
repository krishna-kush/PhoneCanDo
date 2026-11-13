// Shapes the native module returns (Kotlin: api/AgentFunctions.kt,
// api/EngineFunctions.kt, api/InstallFunctions.kt, api/UserKindFunctions.kt, bridge/BridgePrompts.kt,
// prompts/OpenUrlRegistry.kt, notify/LaunchTarget.kt, api/MessageFunctions.kt).
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
  /** It keeps its sign-in, settings and chats in its own folder: it joined an agent of its kind on its machine. */
  ownState: boolean;
  /** "Other agents can wake it": a direct message that asks to may start its run while it is idle (default true). */
  wakeable: boolean;
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

/**
 * The user's caps on what runs at once (Settings), kept natively so the
 * supervisor holds to them with no JS around. null: no cap (the default);
 * otherwise at least 1. A start past the agents' cap first stops the least
 * recently used agent idle a minute, else fails too_many_running; a model
 * past the models' cap fails too_many_models.
 */
export type NativeRunLimits = { maxAgents: number | null; maxModels: number | null };

/**
 * An agent's own ask to stay up while idle in the background
 * (agents_keep_running): why, until when (epoch ms) and that time as the
 * phone shows one. It ends at that time, when the agent takes it back, or
 * with its engine.
 */
export type NativeKeepAsk = { reason: string; until: number; untilText: string };

/**
 * How close the phone is to running out of memory: ok, warn (near the peak:
 * the runner counts down to stopping one agent itself) or critical (Android
 * is about to kill processes: a short countdown).
 */
export type NativeMemoryLevel = 'ok' | 'warn' | 'critical';

/** A running engine (starting or ready) and what its processes take. */
export type NativeMemoryAgent = {
  agentId: string;
  /** Resident memory of its processes (PSS where readable), null when unread. */
  bytes: number | null;
  /** A run is going (the kind's idle rule says it is not idle). */
  working: boolean;
  lastUsedAt: number | null;
  /** The local model it runs on, null for none. */
  modelId: string | null;
};

/** A loaded local model server and the agents holding it. */
export type NativeMemoryModel = {
  modelId: string;
  name: string;
  bytes: number | null;
  /** The agents on it; stopping the model stops these first. */
  agentIds: string[];
  /** It answered ready (false while it loads). */
  ready: boolean;
};

/** What the runner stopped by itself to free memory. */
export type NativeAutoStop = { at: number; agentIds: string[]; modelIds: string[] };

/**
 * The memory guard's reading, sent as phonecandoMemory on every level or
 * countdown change and while the level is not ok (about every 5 s).
 */
export type NativeMemoryStatus = {
  level: NativeMemoryLevel;
  totalBytes: number;
  /** MemoryInfo.availMem now. */
  availBytes: number;
  /** Below this much free memory the level is warn. */
  warnBelowBytes: number;
  /** When the runner stops one agent by itself (epoch ms); null with no countdown. */
  stopAt: number | null;
  /** The agent the countdown would stop now; null with no countdown. */
  nextStopAgentId: string | null;
  agents: NativeMemoryAgent[];
  models: NativeMemoryModel[];
  /** The last automatic stop in this process, so the UI can say what was stopped. */
  lastAutoStop: NativeAutoStop | null;
};

/** How far a message got with one recipient (messages/Message.kt Delivery). */
export type NativeDeliveryStatus = 'queued' | 'delivered' | 'read' | 'refused';

export type NativeDelivery = {
  agentId: string;
  /** The recipient's name when it was sent. */
  name: string;
  /** queued: not yet in its turn; delivered: posted to its chat or claimed by its hook; read: confirmed; refused: dropped unread. */
  status: NativeDeliveryStatus;
  /** Handing it over started the recipient's run. */
  woke: boolean;
  /** Why it was refused (dropped unread past the cap). */
  reason?: string;
};

/**
 * One message between agents, or a runner notice to one (the screen
 * queue), newest first in messageLog. Names are the ones the agents had
 * when it was sent; the log keeps them after an agent is deleted.
 */
export type NativeMessage = {
  id: number;
  /** A notice: agentId null, name "PhoneCanDo", kind null; kind is the sender's kind id. */
  from: { agentId: string | null; name: string; kind: string | null };
  /** One agent; every other agent on a machine (imageId); every other agent on the phone. */
  to: { kind: 'agent' | 'machine' | 'phone'; agentId?: string; name?: string | null; imageId?: string };
  text: string;
  replyTo: number | null;
  sentAt: number;
  /** 0 from a turn the user started; one more for each turn another agent's message started before it. */
  hop: number;
  notice: boolean;
  deliveries: NativeDelivery[];
};

/** Who drives the screen (or has it kept for them) and who waits for it, in order. */
export type NativeScreenQueue = {
  holder: { agentId: string; name: string } | null;
  /** The holder has it kept for them: the screen passed to it from the line. */
  reserved: boolean;
  waiting: { agentId: string; name: string }[];
};

/** The share sheet closed: whether an app was picked, and that app's label (kept on the phone, never sent). */
export type NativeShareResult = { chosen: boolean; app: string | null };

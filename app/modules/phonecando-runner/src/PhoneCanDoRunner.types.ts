// Shapes the native module returns (Kotlin: api/AgentFunctions.kt,
// api/EngineFunctions.kt, api/InstallFunctions.kt, api/UserKindFunctions.kt, bridge/BridgePrompts.kt,
// prompts/OpenUrlRegistry.kt, prompts/PermissionRegistry.kt, notify/LaunchTarget.kt,
// api/MessageFunctions.kt, api/AcpFunctions.kt, acp/AcpAppEvents.kt,
// api/ChecksFunctions.kt).
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

/** How an agent's engine runs: its TUI on our terminal, or ACP mode (pipes, no screen). */
export type NativeEngineMode = 'terminal' | 'acp';

export type NativeEngineStatus = {
  agentId: string;
  state: 'stopped' | 'starting' | 'ready' | 'stopping' | 'died' | 'failed';
  port: string | null;
  error: string | null;
  lastUsedAt: number | null;
  mode: NativeEngineMode;
  /** An ACP turn is running; always false in terminal mode. */
  busy: boolean;
};

/** The model server reading a prompt for agents bound to it with a run going (models/prompt/PromptReading.kt). */
export type NativePromptReading = {
  modelId: string;
  modelName: string;
  agentIds: string[];
  /** New prompt tokens read so far. */
  read: number;
  /** Tokens its prompt cache already held. */
  cached: number;
  /** New prompt tokens to read in all (the whole prompt less `cached`); null when the server does not say. */
  total: number | null;
};

/** The end of a model's server log: whole lines, whether earlier ones were left out, when it was last written (epoch ms) and its size in bytes. */
export type NativeModelServerLog = { text: string; cut: boolean; modifiedAt: number; size: number };

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
  kind: 'unlock' | 'accessibility' | 'open_url' | 'permission';
  agentId: string;
  agentName: string;
  reason: string;
  /** An open_url prompt's link (http or https, at most 2 KiB); absent for the others. */
  url?: string;
  /** A permission prompt's question: what the agent asks to do (the tool call's title). */
  title?: string;
  /** A permission prompt's tool kind (ACP's read, edit, execute, ...), null when the agent names none. */
  toolKind?: string | null;
  /** A permission prompt's answers, one button each; resolvePermission(requestId, optionId). */
  options?: NativeAcpOption[];
};

/** One answer to a permission question; kind is ACP's allow_once, allow_always, reject_once or reject_always. */
export type NativeAcpOption = { optionId: string; name: string; kind: string };

/** A permission question an agent in ACP mode waits on; requestId is what resolvePermission takes. */
export type NativeAcpPermission = {
  requestId: string;
  title: string;
  toolKind: string | null;
  options: NativeAcpOption[];
};

/**
 * One thing an ACP turn shows, by id (a later one with the same id
 * replaces it): the agent's words, its thinking, a tool step with its
 * status (ACP's pending, in_progress, completed, failed), or its plan.
 */
export type NativeAcpItem =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'thought'; text: string }
  | { id: string; type: 'tool'; title: string; kind?: string | null; status?: string | null }
  | { id: string; type: 'plan'; entries: string[] };

/** An agent's ACP turn now (acpSnapshot): its chat, whether a turn runs, what it showed, the open question. */
export type NativeAcpSnapshot = {
  chatId: string | null;
  busy: boolean;
  items: NativeAcpItem[];
  permission: NativeAcpPermission | null;
};

/**
 * What an ACP turn does, as it happens (the phonecandoAcp event). turnEnd's
 * stopReason is ACP's (end_turn, cancelled, refusal, max_tokens,
 * max_turn_requests); error is set when the agent answered the prompt with
 * an error.
 */
export type NativeAcpEvent =
  | { agentId: string; type: 'item'; item: NativeAcpItem }
  | { agentId: string; type: 'busy'; busy: boolean }
  | { agentId: string; type: 'permission'; permission: NativeAcpPermission }
  | { agentId: string; type: 'permissionGone'; requestId: string }
  | { agentId: string; type: 'turnEnd'; stopReason: string | null; error: string | null };

/** What the user did with an open_url prompt: opened it, had native copy it, or Not now. */
export type NativeOpenUrlAction = 'open' | 'copy' | 'dismiss';

/** Where opening the app should land: a tab and, when the reason is one agent, that agent ('checks': its checks). */
export type NativeLaunchTarget = {
  tab: 'home' | 'env' | 'settings' | 'checks';
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
  /** A task a schedule posted (the text is the task's own words); null for any other message. */
  scheduled: { scheduleId: string; by: 'user' | 'agent'; newChat: boolean; timing: string } | null;
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

/** When a schedule runs: once at a time; every so many minutes from `anchor`; daily at "HH:MM" on `days` (none: every day). Times epoch ms. */
export type NativeScheduleTiming =
  | { type: 'once'; at: number }
  | { type: 'every'; minutes: number; anchor: number }
  | { type: 'daily'; time: string; days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[] };

/** What a scheduled run did. */
export type NativeScheduleOutcome = 'started' | 'woke' | 'restarted' | 'asked' | 'busy' | 'missed' | 'failed';

/** One schedule as the runner keeps it (files/state/schedules.json). */
export type NativeSchedule = {
  id: string;
  agentId: string;
  text: string;
  timing: NativeScheduleTiming;
  chat: 'new' | 'same';
  on: boolean;
  by: 'user' | 'agent';
  createdAt: number;
  /** Null: off, or a one-off that ran. */
  nextAt: number | null;
  lastRun: { at: number; outcome: NativeScheduleOutcome; detail?: string } | null;
};

/** One line of the runs log (files/state/schedule-runs.jsonl, newest 200 kept). */
export type NativeScheduleRun = {
  seq: number;
  scheduleId: string;
  agentId: string;
  agentName: string;
  /** The first 200 characters of the task. */
  text: string;
  by: 'user' | 'agent';
  dueAt: number;
  firedAt: number;
  late: boolean;
  outcome: NativeScheduleOutcome;
  detail?: string;
};

/** A new schedule from the app; chat defaults to same for a one-off, new for a repeating one. Every's anchor defaults to now. */
export type NativeScheduleSpec = { agentId: string; text: string; timing: NativeScheduleTiming; chat?: 'new' | 'same' };

/** An edit from the app: only what changed. */
export type NativeSchedulePatch = { text?: string; timing?: NativeScheduleTiming; chat?: 'new' | 'same'; on?: boolean };

/** reason: limit, unsupported, not_found, agent_gone, or a sentence; code: the reason's code. */
export type NativeScheduleResult = { ok: true; schedule: NativeSchedule } | { ok: false; reason: string; code: string };

export type NativeRunNowResult = { ok: true } | { ok: false; reason: string; code: string };

/** A capability an agent may have (kit Capability's wire ids). */
export type NativeCapabilityId =
  | 'tools'
  | 'messages'
  | 'wake'
  | 'task'
  | 'state'
  | 'acp'
  | 'acpTools'
  | 'acpMessages'
  | 'chat';

/** Checked, not checked yet, not working, or off (not declared, or not this agent's). */
export type NativeCheckState = 'checked' | 'unchecked' | 'failed' | 'off';

/** How far messages reach an agent (kit MessagingLevel). */
export type NativeMessagingLevel = 'wakes' | 'delivered' | 'inbox' | 'none';

/**
 * One capability as the agent reads it now: when it was last checked or
 * found not working (epoch ms), on which CLI version, and for a failure
 * its code and what to do.
 */
export type NativeCapabilityCheck = {
  id: NativeCapabilityId;
  state: NativeCheckState;
  cliVersion?: string;
  at?: number;
  code?: string;
  detail?: string;
};

/** What a running check's part does now. */
export type NativeCheckStep = 'starting' | 'reading' | 'answer' | 'working' | 'waiting' | 'checking';

/**
 * Where one capability's test stands in a check: its part hasn't started
 * (queued), it runs with no verdict yet (testing), a verdict came during
 * its part (answered: read the capability's state), none came (unknown) or
 * no part can test it (skipped); why for unknown and skipped.
 */
export type NativeCheckRow = {
  id: NativeCapabilityId;
  part: number;
  status: 'queued' | 'testing' | 'answered' | 'unknown' | 'skipped';
  why?: string;
};

/**
 * An agent's last Check now: its state since startedAt, when anything last
 * moved (epoch ms), the part it is on (1-based, of parts) and that part's
 * mode; while running its step, and how much of the prompt a local model
 * has read while that is the step (total: when the server says); detail
 * says why it got stuck or failed; rows, part by part, the capabilities it
 * tests.
 */
export type NativeCheckRun = {
  state: 'running' | 'done' | 'stuck' | 'cancelled' | 'failed';
  startedAt: number;
  movedAt: number;
  part: number;
  parts: number;
  partMode: 'acp' | 'terminal';
  step?: NativeCheckStep;
  reading?: { read: number; total?: number };
  detail?: string;
  rows: NativeCheckRow[];
};

/**
 * An agent's checks (agentChecks): every capability in kit order, the
 * messaging level that works now, its last Check now, whether its kind
 * can take Check now at all (checkNowWhy says why not), how many parts
 * Check now would run (0 when it can't), and whether it runs on our check
 * model (a stand-in that answers at once) rather than the agent's own.
 */
export type NativeAgentChecks = {
  capabilities: NativeCapabilityCheck[];
  levelNow: NativeMessagingLevel;
  run: NativeCheckRun | null;
  checkNow: boolean;
  checkNowWhy?: string;
  parts: number;
  /** What Check the rest would run (only what isn't checked yet): its parts and the ids it tests; null: nothing left it can test. */
  rest: { parts: number; ids: NativeCapabilityId[] } | null;
  checkModel: boolean;
};

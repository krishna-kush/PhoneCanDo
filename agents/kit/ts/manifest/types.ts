// The agent kind manifest (agent.json, schema 1) and the runtime plugin
// manifest (runtime.json, schema 1) as TypeScript types. The JSON Schemas
// are agents/kit/schema/{agent,runtime}.schema.json; validate.ts and
// runtime-plugin.ts hold the same rules in code.

export type Origin = 'bundled' | 'user';
export type Channel = 'full' | 'lite' | 'play';
export type KindType = 'native' | 'image';
export type Stability = 'stable' | 'preview';
export type Toolchain = 'bun' | 'ndk' | 'rust' | 'zig';
export type Linkage = 'system-only';
export type PhoneTools = 'plugin' | 'mcp:config' | 'mcp:argv' | 'none';
export type EngineStyle = 'server' | 'tui';
export type Home = 'web' | 'tui';
export type IdleSource = 'events' | 'output';
export type LinuxNeed = 'required' | 'optional' | 'none';
/** An image OS's package family (lre-api's PackageFamily ids). */
export type Family = 'apt' | 'apk' | 'dnf' | 'yum' | 'microdnf' | 'pacman' | 'zypper' | 'xbps';
/** What a tui engine's PTY output signals: BEL, OSC 9, OSC 777 notify, OSC 9;4 progress, an OSC 7501 status report. */
export type PtySignal = 'bel' | 'osc9' | 'osc777' | 'progress' | 'osc7501';
/** The engine event a PTY rule raises. */
export type PtyEvent = 'working' | 'waiting' | 'finished' | 'failed' | 'stopped';
export type SignInMethod = 'device-code' | 'paste-code' | 'browser' | 'api-key' | 'in-tui' | 'in-ui';
/** The app palette roles a web adapter maps CSS variables onto. */
export type PaletteRole =
  | 'bg'
  | 'panel'
  | 'panel2'
  | 'fg'
  | 'muted'
  | 'dim'
  | 'faint'
  | 'line'
  | 'lineStrong'
  | 'primary'
  | 'primaryHi';

export interface Licence {
  /** Null when unknown; only a kind we do not redistribute may leave it so. */
  spdx: string | null;
  /** We ship the kind's binaries or files ourselves (always true for native). */
  redistributed: boolean;
  /** Notice file in the kind's folder; required for native. */
  notice?: string;
  terms?: string;
  source: string;
}

/** One staged native library: the build output `from`, packaged as `name`. */
export interface PayloadLib {
  /** lib<prefix>-<role>.so */
  name: string;
  from: string;
  role: string;
  linkage: Linkage;
}

export interface ConfigAsset {
  /** Config folder in the kind's folder, packaged as assets/agents/<id>/config/. */
  dir?: string;
  /** Replaces the full-only files on the channels other than full. */
  overlay?: string;
  /** Globs under `dir` that only the full channel ships. */
  fullOnly?: string[];
  /** Parts from agents/shared/<name>/, packaged inside the config (see part.json). */
  shared?: string[];
  /** Where the config is seeded, relative to the agent's HOME. */
  into: string;
  /** Files seeded once, so user edits survive. */
  keep?: string[];
  /** Files the APK audit requires in the packaged config. */
  required?: string[];
  files?: unknown[];
}

/**
 * How one agent of the kind keeps its sign-in, settings, chats and global
 * instructions in a state folder of its own, so a second agent of the kind
 * can share a machine with the first (which keeps the kind's defaults).
 */
export interface AgentState {
  /** Moves the kind's state into the folder; each value a template with {{stateDir}}, the folder, its one placeholder. */
  env: Record<string, string>;
  /** The instructions file, relative to the state folder; set exactly when the kind has `instructions`. */
  instructions?: string;
  /** The folder `config.into` becomes, relative to the state folder; only when config.into holds the agent's state. */
  config?: string;
}

// --- templates --------------------------------------------------------------
// A template is a string with {{placeholder}}s (PLACEHOLDERS in rules.ts);
// ${…} passes through untouched. {{password}} goes only in env values.

/** An argv item: a template, or args included only when `when` has a non-empty value. */
export type TemplateArg = string | { when: string; args: string[] };

/** A process the host starts: the first argv item is the program. */
export interface Command {
  argv: TemplateArg[];
  /** Added after the host's own env, in order. */
  env?: Record<string, string>;
}

/** A command with its working directory (a template). */
export type CommandIn = Command & { cwd?: string };

// --- engine -----------------------------------------------------------------

export interface HttpPath {
  /** A path on the engine's loopback base URL; may hold placeholders. */
  path: string;
}

/**
 * When the engine counts as ready, one rule: a server engine once `http`
 * answers (required); a tui engine after its first `output` and then
 * `settleMs` of quiet, or once `alive` for `ms` (both have defaults).
 */
export type Readiness =
  | { http: HttpPath }
  | { output: { settleMs?: number; timeoutSec?: number } }
  | { alive: { ms?: number } };

/** Args added when the engine relaunches an agent that ran before; appended unless `at` (an argv index) says where. */
export interface Resume {
  args: string[];
  at?: number;
}

/**
 * Args a tui engine starts with to run a first prompt (a scheduled task):
 * exactly one is `{{prompt}}`, so the prompt is one argv item; appended
 * unless `at` (an argv index, counted as resume's) says where.
 */
export interface PromptArgs {
  args: string[];
  at?: number;
}

export interface Engine {
  style: EngineStyle;
  /** For an image kind, argv[0] is a guest command or an absolute guest path. */
  launch: CommandIn;
  /** HTTP Basic on every engine request: user plus the agent's password (server only). */
  auth?: { basic: { user: string } };
  readiness?: Readiness;
  resume?: Resume;
  /** Tui only. */
  prompt?: PromptArgs;
}

/** A rule over a tui engine's PTY output: `match` (a regex over the OSC text) narrows it. */
export interface PtyRule {
  on: PtySignal;
  match?: string;
  event: PtyEvent;
}

/**
 * A server-sent event stream parsed by the named code hook (server), rules
 * over the PTY output (tui), or the lines the kind's own hooks write with
 * `phonecando-event <name>` (tui), each name mapped to an engine event.
 */
export type EventSource =
  | { sse: HttpPath & { parser: string } }
  | { pty: { rules: PtyRule[] } }
  | { hook: { map: Record<string, PtyEvent> } };

export interface Chats {
  /** A chat's title: GET `path`, then the string at JSON pointer `json`. */
  title: { http: HttpPath & { json: string } };
}

export interface Idle {
  /** What counts as activity: events, or (tui) any PTY output. */
  from: IdleSource[];
  /** Idle after this many seconds without activity. */
  quietSec: number;
}

// --- surfaces ---------------------------------------------------------------

export interface WebPair {
  method: 'POST';
  path: string;
  /** JSON pointers into the reply; the first non-empty string is the code. */
  code: string[];
  /** Where the WebView lands; {{code}} is URL-encoded. */
  url: string;
}

/** How our WebView fits the web UI into the app (data for the app's webAdapter.ts). */
export interface WebAdapter {
  /** localStorage key the web UI reads its color scheme from. */
  colorSchemeKey?: string;
  /** CSS variable → the app palette role it takes. */
  cssVars: Record<string, PaletteRole>;
  /** Selectors of the web UI's own chrome that duplicates our header. */
  hide?: string[];
  /** URLs containing this are the sign-in hand-off, never the web UI's home. */
  authUrl: string;
  /** A regex whose first group is the chat (session id) a URL shows. */
  sessionUrl?: string;
}

export interface WebSurface {
  pair: WebPair;
  adapter: WebAdapter;
}

export interface TerminalSurface {
  /** The kind's TUI attached to its server; the host adds HOME, TMPDIR, TERM and COLORTERM first. */
  client?: CommandIn;
  /** The terminal tab opens a shell in the agent's image (instead of a client). */
  shell?: boolean;
  /** A regex whose first group is the chat title the client's terminal title shows. */
  chatTitle?: string;
}

export interface Surfaces {
  home: Home;
  web?: WebSurface;
  terminal?: TerminalSurface;
  /** tui: a regex whose first group is the chat title in the engine's OSC 0/2 window title. */
  chatTitle?: string;
}

/** What the kind needs from its machine. An image kind needs Linux (`linux: required`). */
export interface Requires {
  linux?: LinuxNeed;
  /** Commands that must be on the guest PATH. */
  commands?: string[];
  /** Runtime plugins (agents/runtimes/<id>/) installed first: `<id>` or `<id>>=<major>`. */
  runtimes?: string[];
}

/**
 * How an image kind is installed into its machine: its runtimes, then the
 * packages for the image's family, then the steps (POSIX sh, with HOME the
 * image home and every runtime's paths on PATH; {{home}} only, no secrets).
 * Each step runs in its own subshell, and again when it fails.
 */
export interface Install {
  /** The families it supports; absent: what its runtimes support, or any. */
  families?: Family[];
  /** Packages per family; `*` is the fallback. */
  packages?: Partial<Record<Family | '*', string[]>>;
  steps?: string[];
  /** How long the whole install may run, every attempt included. */
  timeoutSec?: number;
  /**
   * How many more times a failed runtime script, package install or step
   * (install or update) runs, 0 to 5; absent: 2. The version check runs once.
   */
  retries?: number;
}

/** Steps that update an installed kind (after its runtimes are ensured again). */
export interface Update {
  steps: string[];
}

/** A program whose output names the version: group 1 of `pattern`. */
export interface VersionCheck {
  /** A guest command or path, then its args; {{home}} only. */
  argv: string[];
  pattern: string;
}

export interface SignIn {
  method: SignInMethod;
  note?: string;
}

export interface Manifest {
  schema: 1;
  id: string;
  label: string;
  version: string;
  type: KindType;
  prefix?: string;
  channels: Channel[];
  stability: Stability;
  /** The kind a fresh install starts with; at most one bundled kind sets it, never a user's. */
  default?: boolean;
  licence: Licence;
  payload?: { libs: PayloadLib[] };
  build?: { toolchains: Toolchain[] };
  config?: ConfigAsset;
  /** The kind's global instructions file, relative to HOME: where the runner writes the OS note and who else is on the machine. */
  instructions?: string;
  state?: AgentState;
  /**
   * Where the kind keeps a user's sign-in, settings and chats by default,
   * relative to HOME: deleted when an agent that used them leaves a machine
   * that stays, so the next agent of the kind there starts clean. Never
   * what the machine's other agents share (SHARED_HOME in rules.ts).
   */
  userState?: string[];
  engine?: Engine;
  events?: EventSource[];
  chats?: Chats;
  idle?: Idle;
  surfaces?: Surfaces;
  phoneTools?: PhoneTools;
  /** Code hooks (bundled kinds only): <id>.<name>, registered in agents/builtin. */
  hooks?: string[];
  signIn?: SignIn[];
  requires?: Requires;
  install?: Install;
  update?: Update;
  versionCheck?: VersionCheck;
  /** How the kind takes a local model, by wire API in the order it prefers them. */
  models?: Partial<Record<ModelApi, ModelWiring>>;
  inbox?: Inbox;
}

/** How a hook event's output is read: as it is, or as JSON (the messages go in as a JSON string's content). */
export type InboxFormat = 'text' | 'json';
/** How an idle agent of the kind can be woken: a waiting hook, its server's wake call, or its own reader. */
export type InboxWake = 'hook' | 'server' | 'reader';

/**
 * What `phonecando-inbox <Event>` prints for one of the kind's hook events,
 * and its exit code (default 0; on any other the output goes to stderr).
 */
export interface InboxHook {
  format: InboxFormat;
  /** A string, or (format json) a JSON object; {{messages}} is the rendered messages, its one placeholder. */
  template: string | Record<string, unknown>;
  exit?: number;
}

/** A call to a server engine: `path` may name {{sessionId}} (the chat), the JSON `body`'s strings {{messages}} and {{sessionId}}. */
export interface InboxEndpoint {
  method: 'POST';
  path: string;
  body: Record<string, unknown>;
}

/**
 * How other agents' messages reach a running agent of the kind; without
 * one it only pulls them (its agents_inbox tool). At least one way in.
 */
export interface Inbox {
  /** Per hook event of the kind, whose hook runs `phonecando-inbox <Event>`. */
  hooks?: Record<string, InboxHook>;
  /** `deliver` queues them for the chat (it works, or may not be woken); `wake` posts them to an idle one. */
  server?: {
    deliver: InboxEndpoint;
    wake?: InboxEndpoint;
    /** GET `path` answers the agent's chats newest first; `id` points at the newest one's id (when the host knows none). */
    latest?: { path: string; id: string };
    /** `method` `path` (no placeholders) makes a new chat, the body's strings naming {{title}}; `id` points at its id in the answer. */
    create?: { method: 'POST'; path: string; body: Record<string, unknown>; id: string };
  };
  /** The kind's own extension or plugin reads PHONECANDO_INBOX itself. */
  reader?: boolean;
  /** Absent: an idle agent of the kind cannot be woken. */
  wake?: InboxWake;
}

/** A wire API a model server may serve and a kind may speak. */
export type ModelApi = 'openai-chat' | 'openai-responses' | 'anthropic';

/** What a kind sets to use a local model: {{baseUrl}}, {{model}}, {{contextWindow}}; {{modelKey}} in env only. */
export interface ModelWiring {
  env?: Record<string, string>;
  /** Go in right after the program. */
  args?: string[];
}

/**
 * A runtime plugin (agents/runtimes/<id>/runtime.json): a language runtime
 * installed into the machine of an agent that needs it, never into others.
 */
export interface RuntimePlugin {
  schema: 1;
  id: string;
  label: string;
  /** The major version our installer puts in place. */
  provides: number;
  families: Family[];
  /** The install script per family (a file in the plugin folder); `*` is the fallback. */
  install: Partial<Record<Family | '*', string>>;
  /** Guest folders put first on PATH ({{home}} only). */
  paths?: string[];
  /** Group 1 of `pattern` in the output of `argv` is the major version. */
  check: VersionCheck;
  licence: { spdx: string; source: string };
}

export type ProblemCode =
  | 'type'
  | 'required'
  | 'unknown'
  | 'const'
  | 'enum'
  | 'pattern'
  | 'length'
  | 'range'
  | 'unique'
  | 'reserved'
  | 'forbidden'
  | 'mismatch'
  | 'too-large';

export interface Problem {
  /** JSON pointer into the manifest ('' is the whole document). */
  path: string;
  code: ProblemCode;
  detail: string;
}

export interface ValidationResult {
  ok: boolean;
  problems: Problem[];
}

export interface ValidateOptions {
  origin: Origin;
}

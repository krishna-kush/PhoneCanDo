// The manifest's vocabulary: enums, reserved names, patterns and limits.
// agents/kit/schema/agent.schema.json says the same (validate.test.ts
// compares them), so change both together.

export const SCHEMA_VERSION = 1;
export const CHANNELS = ['full', 'lite', 'play'];
export const KIND_TYPES = ['native', 'image'];
export const STABILITIES = ['stable', 'preview'];
export const TOOLCHAINS = ['bun', 'ndk', 'rust', 'zig'];
export const LINKAGES = ['system-only'];
export const ENGINE_STYLES = ['server', 'tui'];
export const PHONE_TOOLS = ['plugin', 'mcp:config', 'mcp:argv', 'none'];
export const HOMES = ['web', 'tui'];
export const PAIR_METHODS = ['POST'];
export const IDLE_SOURCES = ['events', 'output'];
/** What a tui engine's PTY output can signal, and the engine events a rule maps it to. */
export const PTY_SIGNALS = ['bel', 'osc9', 'osc777', 'progress', 'osc7501'];
export const PTY_EVENTS = ['working', 'waiting', 'finished', 'failed', 'stopped'];
/** How much a kind needs Linux (requires.linux); an image kind needs it. */
export const LINUX_NEEDS = ['required', 'optional', 'none'];
export const READINESS_RULES = ['http', 'output', 'alive'];
/** Where a kind's events come from: an SSE stream (server), PTY rules (tui), or its hooks' phonecando-event lines (tui). */
export const EVENT_SOURCES = ['sse', 'pty', 'hook'];
export const SIGN_IN_METHODS = ['device-code', 'paste-code', 'browser', 'api-key', 'in-tui', 'in-ui'];
export const PALETTE_ROLES = [
  'bg',
  'panel',
  'panel2',
  'fg',
  'muted',
  'dim',
  'faint',
  'line',
  'lineStrong',
  'primary',
  'primaryHi',
];

// The package families an image's OS can have: lre-api's PackageFamily ids,
// name for name (families.test.ts reads lre's source). install.packages
// keys them, with ANY_FAMILY as the fallback.
export const FAMILIES = ['apt', 'apk', 'dnf', 'yum', 'microdnf', 'pacman', 'zypper', 'xbps'];
export const ANY_FAMILY = '*';
/** The one placeholder install steps, version checks and runtime paths may use: the image home. */
export const GUEST_PLACEHOLDERS = ['home'];

// Template placeholders, {{name}}. The host fills them in; `password` only
// ever lands in an env value, never in argv, a path or a URL.
export const PLACEHOLDERS = ['libDir', 'home', 'tmp', 'port', 'serverUrl', 'bridgeUrl', 'password', 'projectDir', 'sessionId', 'code'];
export const SECRET_PLACEHOLDER = 'password';

// A local model (`models`): the wire APIs a kind can talk to a model server
// with, in the order it prefers them, and what its env and args may fill in.
// `modelKey` (the model server's key) only ever lands in an env value.
export const MODEL_APIS = ['openai-chat', 'openai-responses', 'anthropic'];
export const MODEL_PLACEHOLDERS = ['baseUrl', 'model', 'contextWindow', 'modelKey'];
export const MODEL_SECRET_PLACEHOLDER = 'modelKey';

// Ids that would shadow `./manage agent <verb>`, or whose assets
// (assets/agents/<id>/) would collide with the kit's scripts, the runtimes'
// or the shared parts'; prefixes that would collide with our own libraries
// in the APK lib dir.
export const RESERVED_IDS = ['new', 'list', 'check', 'kit', 'runtimes', 'shared'];
export const RESERVED_PREFIXES = ['phonecando', 'proot', 'llama'];
export const USER_ID_PREFIX = 'user.';
export const MAX_USER_MANIFEST_BYTES = 64 * 1024;
/** The most UTF-8 bytes a user-added kind's install steps, or its update steps, hold, joined by newlines. */
export const MAX_USER_SCRIPT_BYTES = 32 * 1024;
/** Env names a user-added kind may not set on top of envReserved: its launch builds PATH from its runtimes. */
export const USER_RESERVED_ENV = ['PATH'];
/** Fields a user-added kind may leave out: it need not come from a published project. */
export const USER_OPTIONAL = ['licence'];

const templateOf = (names: string[]) => `^(?:[^{]|\\{(?!\\{)|\\{\\{(?:${names.join('|')})\\}\\})*$`;

// The schema's patterns, character for character (validate.test.ts compares).
export const PATTERNS = {
  id: '^(?:user\\.)?[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
  name: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
  prefix: '^[a-z][a-z0-9]*$',
  spdx: '^[A-Za-z0-9][A-Za-z0-9.+-]*(?: (?:AND|OR|WITH) [A-Za-z0-9][A-Za-z0-9.+-]*)*$',
  url: '^https://[^\\s]+$',
  relPath: '^(?!/)(?!.*//)(?!.*/$)(?!(?:.*/)?\\.\\.?(?:/|$))[^\\\\\\u0000]+$',
  libName: '^lib[a-z][a-z0-9]*-[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\.so$',
  libFrom: '^[^/\\\\\\u0000]+$',
  /** Known placeholders only, no {{password}}. */
  template: templateOf(PLACEHOLDERS.filter((n) => n !== SECRET_PLACEHOLDER)),
  /** An env value: known placeholders, {{password}} included. */
  envTemplate: templateOf(PLACEHOLDERS),
  /** A model arg: the model placeholders, no {{modelKey}}. */
  modelTemplate: templateOf(MODEL_PLACEHOLDERS.filter((n) => n !== MODEL_SECRET_PLACEHOLDER)),
  /** A model env value: the model placeholders, {{modelKey}} included. */
  modelEnvTemplate: templateOf(MODEL_PLACEHOLDERS),
  /** What runs in the guest (install steps, version checks, runtime paths): {{home}} only. */
  guestTemplate: templateOf(GUEST_PLACEHOLDERS),
  httpPath: '^/\\S*$',
  jsonPointer: '^(?:/(?:[^~/]|~[01])*)+$',
  envName: '^[A-Za-z_][A-Za-z0-9_]*$',
  /** Env names the host owns. */
  envReserved: '^(?:PHONECANDO_.*|LD_.*|HOME|TMPDIR)$',
  hookId: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
  basicUser: '^[^:\\s]+$',
  cssVar: '^--[A-Za-z0-9_-]+$',
  storageKey: '^[A-Za-z0-9][A-Za-z0-9._:-]*$',
  /** Goes into a single-quoted JS string and a CSS rule: no quote, backslash, brace or control character. */
  selector: "^[^'\\\\{}\\u0000-\\u001f]+$",
  /** An image kind's program: a guest command name or an absolute guest path, no placeholders. */
  guestProgram: '^(?:/[^{}\\s]*|[^/{}\\s]+)$',
  /** A command an image kind needs on PATH (requires.commands). */
  command: '^[A-Za-z0-9_][A-Za-z0-9._+-]*$',
  /** A runtime a kind needs (requires.runtimes): its id, optionally at least a major version. */
  runtimeNeed: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:>=[1-9][0-9]{0,3})?$',
  /** A package name (install.packages), with an optional version or repo suffix; no shell syntax. */
  package: '^[A-Za-z0-9][A-Za-z0-9._+:=@/~-]*$',
  /** A name the kind's hooks pass to phonecando-event (events[].hook.map). */
  eventName: '^[A-Za-z0-9][A-Za-z0-9._:-]*$',
  /** A version check's program: a guest command name, an absolute guest path or a path under {{home}}. */
  guestTool: '^(?:(?:\\{\\{home\\}\\})?/[^{}\\s]*|[^/{}\\s]+)$',
  /** A guest folder for PATH: absolute, or under {{home}}; no ':', quote or space. */
  guestPath: '^(?:\\{\\{home\\}\\})?(?:/[A-Za-z0-9._+-]+)+$',
};

export const MAX = {
  id: 64,
  text: 64,
  note: 200,
  name: 64,
  prefix: 16,
  url: 512,
  relPath: 256,
  libFrom: 128,
  template: 1024,
  envName: 128,
  regex: 256,
  hookId: 128,
  cssVar: 128,
  selector: 256,
  quietSec: 86400,
  /** Readiness waits, in milliseconds and seconds. */
  readyMs: 60000,
  readySec: 3600,
  /** The argv index resume args go in at (after the program). */
  resumeAt: 256,
  /** A package name with its suffix. */
  package: 128,
  /** How long an install may run, in seconds. */
  installSec: 7200,
  /** How many more times a failed install unit (a runtime's script, the packages, a step) may run. */
  installRetries: 5,
  /** The highest major version a runtime names. */
  major: 9999,
};

/** Config fields that describe the bundled asset folder, so need config.dir. */
export const CONFIG_NEEDS_DIR = ['overlay', 'fullOnly', 'shared'];

export const REQUIRED = ['schema', 'id', 'label', 'version', 'type', 'channels', 'stability', 'licence'];
/** The kind a fresh install starts with: true on at most one bundled kind (cli/manifests.mjs), never a user's. */
const DEFAULT_FIELDS = ['default'];
const PACKAGING_FIELDS = ['prefix', 'payload', 'build', 'config'];
/** What the kind needs from its machine (kinds.ts checks it). */
const NEEDS_FIELDS = ['requires'];
/** How an image kind is installed into its machine (install.ts checks these). */
export const INSTALL_FIELDS = ['install', 'update', 'versionCheck'];
/** What runs and how the app shows it (runtime.ts checks these). */
export const RUNTIME_FIELDS = ['engine', 'events', 'chats', 'idle', 'surfaces', 'phoneTools', 'hooks', 'signIn'];
/** How a local model is wired into the kind (models.ts checks it). */
export const MODEL_FIELDS = ['models'];
export const FIELDS = [...REQUIRED, ...DEFAULT_FIELDS, ...PACKAGING_FIELDS, ...NEEDS_FIELDS, ...RUNTIME_FIELDS, ...INSTALL_FIELDS, ...MODEL_FIELDS];

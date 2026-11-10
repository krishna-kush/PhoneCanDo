// The custom agent form: what the user types to describe an agent kind of
// their own, and how each field reads out of a manifest (formOf) for an
// edit. buildUserManifest (build.ts) writes the fields back. Pure (zero RN
// imports).
import { isObject, type Json } from '../../../../../agents/kit/ts/manifest/primitives.ts';
import { FAMILIES } from '../../../../../agents/kit/ts/manifest/rules.ts';
import { scriptOf } from './steps.ts';
import { joinWords } from './words.ts';

export type UserAgentForm = {
  /** The name the app shows (`label`). */
  name: string;
  /** What starts the agent's TUI in its machine, as words (`engine.launch.argv`). */
  command: string;
  /** The install steps, a blank line between two (`install.steps`; `update.steps` too). */
  script: string;
  /** Packages for any OS (`install.packages["*"]`), blanks or commas between them. */
  packages: string;
  /** Packages for one family, used there instead of `packages`; empty: `packages`. */
  familyPackages: Record<string, string>;
  /** What prints the installed version (`versionCheck.argv`); empty: the command's program with --version. */
  versionCommand: string;
  /** A regex whose group 1 is the version; empty: DEFAULT_VERSION_PATTERN. */
  versionPattern: string;
  /** It runs on Node.js 22 or newer (`requires.runtimes`: node>=22). */
  needsNode: boolean;
  /** A bell in its output means it waits for the user (`events`: a bel → waiting rule). */
  bellWaits: boolean;
  /** A regex whose group 1 is the chat title in the window title (`surfaces.chatTitle`). */
  titlePattern: string;
  /** It may use the phone tools: its engine gets the bridge (`phoneTools`, else none). */
  phoneTools: boolean;
};

/** The families a form may name packages for, in the kit's order. */
export const FORM_FAMILIES: readonly string[] = FAMILIES;

/** The first dotted number in the version command's output. */
export const DEFAULT_VERSION_PATTERN = '(\\d+(?:\\.\\d+)+)';

/** The Node.js the form's switch asks for (the runtime plugin `node`). */
export const NODE_RUNTIME = 'node';
export const NODE_MAJOR = 22;

/** The env names our bridge goes by in an engine's env (EngineEnv). */
const BRIDGE_ENV = ['PHONECANDO_BRIDGE_URL', 'PHONECANDO_BRIDGE_TOKEN'];

export function emptyForm(): UserAgentForm {
  return {
    name: '',
    command: '',
    script: '',
    packages: '',
    familyPackages: {},
    versionCommand: '',
    versionPattern: '',
    needsNode: false,
    bellWaits: false,
    titlePattern: '',
    phoneTools: false,
  };
}

/** The runtime id of a `requires.runtimes` item (`node>=22` → node). */
export function runtimeIdOf(need: unknown): string | null {
  return typeof need === 'string' ? need.split('>=')[0] : null;
}

/** A PTY rule that turns a bell into "waiting". */
export function isBellRule(rule: unknown): boolean {
  return isObject(rule) && rule.on === 'bel' && rule.event === 'waiting' && !('match' in rule);
}

/** The string items of an argv (a `{when, args}` item is the kit's, never typed in the form). */
export function textArgv(argv: unknown): string[] {
  return Array.isArray(argv) ? argv.filter((item): item is string => typeof item === 'string') : [];
}

const words = (list: unknown): string => (Array.isArray(list) ? list.filter((w) => typeof w === 'string').join(' ') : '');

// The version command as typed: empty when it is the default one.
function versionCommandOf(check: Json | null, program: string | undefined): string {
  const argv = check ? textArgv(check.argv) : [];
  return argv.length === 2 && argv[0] === program && argv[1] === '--version' ? '' : joinWords(argv);
}

/** The form a manifest fills: what an edit starts from. */
export function formOf(manifest: Json): UserAgentForm {
  const engine = isObject(manifest.engine) ? manifest.engine : {};
  const argv = isObject(engine.launch) ? textArgv(engine.launch.argv) : [];
  const install = isObject(manifest.install) ? manifest.install : {};
  const packages = isObject(install.packages) ? install.packages : {};
  const check = isObject(manifest.versionCheck) ? manifest.versionCheck : null;
  const requires = isObject(manifest.requires) ? manifest.requires : {};
  const runtimes = Array.isArray(requires.runtimes) ? requires.runtimes : [];
  const events = Array.isArray(manifest.events) ? manifest.events : [];
  const surfaces = isObject(manifest.surfaces) ? manifest.surfaces : {};
  const familyPackages: Record<string, string> = {};
  for (const family of FORM_FAMILIES) if (family in packages) familyPackages[family] = words(packages[family]);
  return {
    name: typeof manifest.label === 'string' ? manifest.label : '',
    command: joinWords(argv),
    script: scriptOf(textArgv(install.steps)),
    packages: words(packages['*']),
    familyPackages,
    versionCommand: versionCommandOf(check, argv[0]),
    versionPattern: check && check.pattern !== DEFAULT_VERSION_PATTERN && typeof check.pattern === 'string' ? check.pattern : '',
    needsNode: runtimes.some((need) => runtimeIdOf(need) === NODE_RUNTIME),
    bellWaits: events.some((e) => isObject(e) && isObject(e.pty) && Array.isArray(e.pty.rules) && e.pty.rules.some(isBellRule)),
    titlePattern: typeof surfaces.chatTitle === 'string' ? surfaces.chatTitle : '',
    phoneTools: typeof manifest.phoneTools === 'string' && manifest.phoneTools !== 'none',
  };
}

/** Whether the command's words name our bridge (`${PHONECANDO_BRIDGE_TOKEN}` in an MCP config arg). */
export function namesBridge(texts: readonly string[]): boolean {
  return texts.some((text) => BRIDGE_ENV.some((name) => text.includes(name)));
}

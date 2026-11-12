// The custom agent form as a manifest (agent.json) the runner loads as a
// user kind: an image kind whose engine is its own TUI, made the way our
// image kinds are (Gemini CLI): its program run in the agent's machine from
// the project folder, the install the form describes (Node.js, packages,
// steps, run again as the update), its version check, the bell rule, the
// chat title and its phone tools. An edit starts from the kind's manifest
// (`base`) and keeps every field the form does not cover (sign-in notes,
// hook events, readiness, a distinct update…), and its id. The result has
// passed the kit's validator for origin user; the runner checks it again
// when it saves. Pure (zero RN imports): scripts/vectors/test_user_manifest.js.
import { isObject, utf8Length, type Json } from '../../../../../agents/kit/ts/manifest/primitives.ts';
import {
  MAX,
  MAX_USER_MANIFEST_BYTES,
  MAX_USER_SCRIPT_BYTES,
} from '../../../../../agents/kit/ts/manifest/rules.ts';
import { validate } from '../../../../../agents/kit/ts/manifest/validate.ts';
import {
  DEFAULT_VERSION_PATTERN,
  FORM_FAMILIES,
  NODE_MAJOR,
  NODE_RUNTIME,
  isBellRule,
  namesBridge,
  runtimeIdOf,
  textArgv,
  type UserAgentForm,
} from './form.ts';
import { userKindId } from './ids.ts';
import { stepsOf } from './steps.ts';
import { splitList, splitWords } from './words.ts';

export type FormField = keyof UserAgentForm;

/** What keeps the form from making a kind: the field it is about (null: none in particular) and why. */
export type FormProblem = { field: FormField | null; text: string };

export type Built =
  | { ok: true; id: string; manifest: Json; text: string }
  | { ok: false; problems: FormProblem[] };

export type BuildOptions = {
  /** The kind being edited, as saved; null for a new one. */
  base: Json | null;
  /** The ids of the user's kinds, so a new one gets its own. */
  taken: readonly string[];
};

// What a new kind gets: the channels that run Linux, idle after two quiet
// minutes, and the bell rule.
const channels = () => ['full', 'lite'];
const idle = () => ({ from: ['output'], quietSec: 120 });
const bellRule = () => ({ on: 'bel', event: 'waiting' });

// Where the kit's problems land in the form, by JSON pointer.
const FIELD_OF: [string, FormField][] = [
  ['/label', 'name'],
  ['/engine/launch/argv', 'command'],
  ['/install/steps', 'script'],
  ['/update/steps', 'script'],
  ['/install/packages/*', 'packages'],
  ['/install/packages', 'familyPackages'],
  ['/versionCheck/argv', 'versionCommand'],
  ['/versionCheck/pattern', 'versionPattern'],
  ['/requires/runtimes', 'needsNode'],
  ['/surfaces/chatTitle', 'titlePattern'],
  ['/phoneTools', 'phoneTools'],
  ['/inbox', 'messageEvent'],
];

function fieldOf(path: string): FormField | null {
  return FIELD_OF.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? null;
}

const clone = (json: Json): Json => JSON.parse(JSON.stringify(json)) as Json;
const objectOr = (value: unknown): Json => (isObject(value) ? { ...value } : {});

export function buildUserManifest(form: UserAgentForm, { base, taken }: BuildOptions): Built {
  const problems: FormProblem[] = [];
  const add = (field: FormField | null, text: string) => problems.push({ field, text });

  const name = form.name.trim();
  if (name === '') add('name', 'Give it a name.');
  const command = splitWords(form.command);
  if (!command.ok) add('command', 'A quote is not closed.');
  else if (command.words.length === 0) add('command', 'Say what starts the agent.');
  const version = splitWords(form.versionCommand);
  if (!version.ok) add('versionCommand', 'A quote is not closed.');
  const steps = stepsOf(form.script);
  steps.forEach((step, i) => {
    if (step.length > MAX.template) {
      add('script', `Step ${i + 1} is longer than ${MAX.template} characters. Split it with a blank line.`);
    }
  });
  if (utf8Length(steps.join('\n')) > MAX_USER_SCRIPT_BYTES) {
    add('script', `The script is longer than ${MAX_USER_SCRIPT_BYTES / 1024} KiB.`);
  }
  if (!command.ok || !version.ok || problems.length > 0) return { ok: false, problems };

  const argv = command.words;
  const launchEnv = isObject(base?.engine) && isObject(base.engine.launch) ? base.engine.launch.env : null;
  const bridged = namesBridge([...argv, ...(isObject(launchEnv) ? Object.values(launchEnv).map(String) : [])]);
  if (bridged && !form.phoneTools) {
    add('phoneTools', 'The command uses the phone tools (PHONECANDO_BRIDGE_…). Turn phone tools on, or take that out.');
    return { ok: false, problems };
  }

  const m: Json = base
    ? clone(base)
    : { schema: 1, id: userKindId(name, taken), label: name, version: '1', type: 'image', channels: channels(), stability: 'preview' };
  m.label = name;
  setRequires(m, form);
  setInstall(m, form, steps, version.words.length > 0 ? version.words : [argv[0], '--version'], base);
  setEngine(m, argv);
  setEvents(m, form.bellWaits);
  if (!('idle' in m)) m.idle = idle();
  setSurfaces(m, form.titlePattern.trim());
  setInbox(m, form);
  m.phoneTools = !form.phoneTools ? 'none' : namesBridge(argv) ? 'mcp:argv' : 'mcp:config';
  if (base && JSON.stringify(m) !== JSON.stringify(base)) m.version = nextVersion(base.version);

  const result = validate(m, { origin: 'user' });
  for (const p of result.problems) {
    // A version command left empty is the command's program: its problem is the command's.
    const named = fieldOf(p.path);
    const field = named === 'versionCommand' && version.words.length === 0 ? 'command' : named;
    add(field, field ? p.detail : `${p.path || '/'}: ${p.detail}`);
  }
  const text = `${JSON.stringify(m, null, 2)}\n`;
  if (result.ok && utf8Length(text) > MAX_USER_MANIFEST_BYTES) {
    add(null, `The agent is larger than ${MAX_USER_MANIFEST_BYTES / 1024} KiB.`);
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, id: m.id as string, manifest: m, text };
}

// Other agents' messages: one hook of the agent's own (the kit's
// phonecando-inbox prints them there), as plain text or the JSON the user
// gave; none: the agent reads them with agents_inbox. A custom kind is a
// TUI that is never woken, so the block has hooks only.
function setInbox(m: Json, form: UserAgentForm) {
  const event = form.messageEvent.trim();
  if (event === '') {
    delete m.inbox;
    return;
  }
  const json = form.messageJson.trim();
  const hook: Json = json !== '' ? { format: 'json', template: json } : { format: 'text', template: '{{messages}}' };
  if (form.messageExit2) hook.exit = 2;
  m.inbox = { hooks: { [event]: hook } };
}

// Linux, and Node.js 22 or newer when the form asks for it; other runtimes stay.
function setRequires(m: Json, form: UserAgentForm) {
  const requires = objectOr(m.requires);
  requires.linux = 'required';
  const runtimes = Array.isArray(requires.runtimes) ? requires.runtimes : [];
  const node = runtimes.find((need) => runtimeIdOf(need) === NODE_RUNTIME && Number(String(need).split('>=')[1]) >= NODE_MAJOR);
  const others = runtimes.filter((need) => runtimeIdOf(need) !== NODE_RUNTIME);
  const next = form.needsNode ? [node ?? `${NODE_RUNTIME}>=${NODE_MAJOR}`, ...others] : others;
  if (next.length > 0) requires.runtimes = next;
  else delete requires.runtimes;
  m.requires = requires;
}

// An install when the form has steps, packages or Node.js; its update runs
// the same steps unless the base kind had an update of its own.
function setInstall(m: Json, form: UserAgentForm, steps: string[], versionArgv: string[], base: Json | null) {
  const packages: Record<string, string[]> = {};
  const any = splitList(form.packages);
  if (any.length > 0) packages['*'] = any;
  for (const family of FORM_FAMILIES) {
    const list = splitList(form.familyPackages[family] ?? '');
    if (list.length > 0) packages[family] = list;
  }
  if (steps.length === 0 && Object.keys(packages).length === 0 && !form.needsNode) {
    delete m.install;
    delete m.update;
    delete m.versionCheck;
    return;
  }
  const install = objectOr(m.install);
  if (Object.keys(packages).length > 0) install.packages = packages;
  else delete install.packages;
  if (steps.length > 0) install.steps = steps;
  else delete install.steps;
  m.install = install;

  const baseInstall = isObject(base?.install) ? textArgv(base.install.steps) : [];
  const baseUpdate = isObject(base?.update) ? textArgv(base.update.steps) : null;
  const ownUpdate = baseUpdate != null && JSON.stringify(baseUpdate) !== JSON.stringify(baseInstall);
  if (!ownUpdate) {
    if (steps.length > 0) m.update = { steps };
    else delete m.update;
  }
  m.versionCheck = { argv: versionArgv, pattern: form.versionPattern.trim() || DEFAULT_VERSION_PATTERN };
}

// Its TUI, run from the project folder unless the base kind says where.
function setEngine(m: Json, argv: string[]) {
  const engine = objectOr(m.engine);
  engine.style = 'tui';
  const launch = objectOr(engine.launch);
  launch.argv = argv;
  if (!('cwd' in launch)) launch.cwd = '{{projectDir}}';
  engine.launch = launch;
  m.engine = engine;
}

// The bell rule in or out; every other event source and rule stays where it is.
function setEvents(m: Json, bellWaits: boolean) {
  const sources = Array.isArray(m.events) ? m.events : [];
  const ptyOf = (source: unknown): unknown[] | null =>
    isObject(source) && isObject(source.pty) && Array.isArray(source.pty.rules) ? source.pty.rules : null;
  const hasBell = sources.some((source) => ptyOf(source)?.some(isBellRule));
  if (bellWaits === hasBell) return;
  const events: unknown[] = [];
  for (const source of sources) {
    const rules = ptyOf(source);
    if (!rules) events.push(source);
    else if (bellWaits) events.push(source);
    else if (rules.some((rule) => !isBellRule(rule))) {
      const s = source as Json;
      events.push({ ...s, pty: { ...(s.pty as Json), rules: rules.filter((rule) => !isBellRule(rule)) } });
    }
  }
  if (bellWaits) {
    const pty = events.find((source) => ptyOf(source) != null) as Json | undefined;
    if (pty) pty.pty = { ...(pty.pty as Json), rules: [bellRule(), ...(ptyOf(pty) ?? [])] };
    else events.push({ pty: { rules: [bellRule()] } });
  }
  if (events.length > 0) m.events = events;
  else delete m.events;
}

// Its TUI is Home; the terminal tab a shell in its machine.
function setSurfaces(m: Json, chatTitle: string) {
  const surfaces = objectOr(m.surfaces);
  surfaces.home = 'tui';
  if (!('terminal' in surfaces)) surfaces.terminal = { shell: true };
  if (chatTitle !== '') surfaces.chatTitle = chatTitle;
  else delete surfaces.chatTitle;
  m.surfaces = surfaces;
}

// A whole-number version counts up with each change; any other stays.
function nextVersion(version: unknown): string {
  if (typeof version === 'string' && /^\d+$/.test(version)) return String(Number(version) + 1);
  return typeof version === 'string' ? version : '1';
}

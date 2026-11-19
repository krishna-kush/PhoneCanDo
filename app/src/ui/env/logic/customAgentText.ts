// The custom agent pages' words. Pure (zero RN imports): what we say about
// the risk before a save or an import, which of the form's fields are
// needed or optional, its install choices and hints, how a family and a
// runtime read, a row's line, a refused delete,
// and the problems the form shows under a field and above its button.
import type { FormField, FormProblem } from '../../../engine/agents/user/build.ts';
import { isPreset, type InstallWay, type PresetWay } from '../../../engine/agents/user/install.ts';

/** Under the custom agent form's title: what must be filled in. */
export const FORM_NEEDS = 'Name, how it installs and the command are needed. The rest is optional.';

/** Then what the form makes. */
export const FORM_INTRO = 'Any agent with a terminal UI. It runs in a machine like the others, and Home shows its terminal.';

/** The small mark after a field's label: it must be filled in, or it may stay empty. */
export type FieldTag = 'needed' | 'optional';

/**
 * Each field's mark. A switch has none: its default (off) is safe. The
 * package and the script are needed when the install choice shows them.
 */
export const FIELD_TAGS: Partial<Record<FormField, FieldTag>> = {
  name: 'needed',
  install: 'needed',
  installPackage: 'needed',
  script: 'needed',
  command: 'needed',
  acpCommand: 'optional',
  packages: 'optional',
  familyPackages: 'optional',
  versionCommand: 'optional',
  versionPattern: 'optional',
  titlePattern: 'optional',
  messageEvent: 'optional',
  messageJson: 'optional',
};

/** The mark as drawn after the label ("Name · needed"). */
export function tagText(tag: FieldTag): string {
  return `· ${tag}`;
}

/** A label and its mark as a screen reader says them. */
export function spokenLabel(label: string, tag?: FieldTag): string {
  return tag ? `${label}, ${tag}` : label;
}

/** Said plainly before anything is saved or imported. */
export const SAFETY_LINES = [
  "A machine isn't a sandbox: what runs in it runs as this app, so it can reach the app's files and your other machines.",
  'The install script runs as root in the agent\'s machine, with network access.',
  "Importing someone else's agent runs their code on your phone. Read its script first.",
];

export const PHONE_TOOLS_ON =
  'Its machine gets PHONECANDO_BRIDGE_URL and PHONECANDO_BRIDGE_TOKEN. Point the agent at the MCP server ${PHONECANDO_BRIDGE_URL}/mcp with the header Authorization: Bearer ${PHONECANDO_BRIDGE_TOKEN}, in its config or its command.';

export const PHONE_TOOLS_OFF = 'Off: the agent never gets the bridge or its token.';

export const MESSAGE_EVENT_HINT =
  "One of the agent's own hooks whose output it adds to its turn (after a tool call, or when you prompt it).";

export const MESSAGE_JSON_HINT =
  'If that hook must print JSON: the JSON, with {{messages}} inside one of its strings, e.g. {"additionalContext":"{{messages}}"}.';

/** The install choices, in INSTALL_WAYS order: a name and what it means. */
export const INSTALL_CHOICES: Record<InstallWay, { label: string; note: string }> = {
  npm: { label: 'npm package', note: 'We install it with npm, on Node.js 22.' },
  python: { label: 'Python package', note: 'We install it with uv, on Python 3.12.' },
  script: { label: 'Install script', note: 'Your own shell steps, run as root in its machine.' },
  none: { label: 'Nothing to install', note: "It's already in the machine." },
};

/** A package install's one field. */
export const PACKAGE_FIELD: Record<PresetWay, { label: string; placeholder: string; hint: string }> = {
  npm: {
    label: 'npm package',
    placeholder: '@scope/cli',
    hint: 'Like @rubber-duck/cli. We install the latest; Update agent gets the newest.',
  },
  python: {
    label: 'Python package',
    placeholder: 'rubber-duck',
    hint: 'Like rubber-duck, its name on PyPI. We install the latest; Update agent gets the newest.',
  },
};

export const SCRIPT_HINT =
  "Runs as root in the agent's machine, with HOME at /root. A blank line starts the next step. A step that fails runs again, so make each safe to rerun. Update agent runs it again.";

/** Under the command: where a package's guess came from, or what goes there. */
export function commandHint(way: InstallWay): string {
  return isPreset(way)
    ? 'Filled in from the package. If its program has another name, change it.'
    : "What starts it in its machine. Use the full path when it isn't on PATH. Quotes group words.";
}

/** Why an ACP command is worth giving. */
export const ACP_LINE =
  "With it, the agent can take scheduled tasks and other agents' messages while you're away, and its own app stays on Home.";

/** Under the ACP command, always: what to do about an agent without one. */
export const ACP_NONE_NOTE =
  'No ACP mode? PhoneCanDo is source-available: you can add this agent to our repo the way many built-in agents run, with a flag that starts it on a task and hooks for messages.';

/** The guide that note points to, opened in the browser. */
export const ADD_AGENT_GUIDE = {
  label: 'Read the guide',
  url: 'https://github.com/krishna-kush/PhoneCanDo/blob/HEAD/docs/guides/adding-an-agent.md',
};

/** When no app opens a link. */
export function openElsewhere(url: string): string {
  return `Open ${url} in a browser.`;
}

/** What an optional field means left empty (a switch: left off), and more where the idea needs it. */
export type FieldHelp = { empty: string; more?: string };

const FIELD_HELP: Partial<Record<FormField, FieldHelp>> = {
  acpCommand: {
    empty:
      "If empty: no background mode. It can't take scheduled tasks or be woken by a message; messages wait in its inbox, or are refused when phone tools are off.",
    more: "ACP (Agent Client Protocol) is a standard way for an app to drive a coding agent, and many agents have it: look for --acp or acp in its help. With it we hand it scheduled tasks and messages as prompts while you're away, and its own app stays on Home.",
  },
  phoneTools: {
    empty:
      "Off: it can't use the phone tools, message other agents or schedule itself. Messages to it are refused; with an ACP command they still come as prompts, but it can't answer through the tools.",
  },
  packages: {
    empty: "If empty: the system's package manager installs nothing extra.",
    more: 'Packages per OS: a system whose own field is empty gets these.',
  },
  familyPackages: { empty: "If a system's field is empty: it gets the Packages above." },
  versionCommand: { empty: 'If empty: we run {program} --version.' },
  versionPattern: {
    empty: "If empty: we read the first number like 1.2.3. If there is none, the install says it couldn't read its version.",
  },
  bellWaits: { empty: 'Off: the app won\'t show "waiting for you" when it rings.' },
  titlePattern: { empty: "If empty: its notification shows the agent's name, not the chat title." },
  messageEvent: {
    empty:
      'If empty: nothing is pushed into its turn. It reads messages when it checks its inbox, or gets them as a prompt while idle if it has an ACP command.',
    more: 'A hook is a command the agent runs at a set moment, like after a tool call or when you send a prompt. Ours prints the waiting messages into its turn.',
  },
  messageJson: { empty: 'If empty: the hook prints them as plain text.' },
  needsNode: { empty: 'Off: a script that runs node or npm fails with "command not found". The npm choice turns it on for you.' },
  needsPython: { empty: 'Off: a script that runs uv fails with "command not found". The Python choice turns it on for you.' },
};

/** A field's help; null for a needed field. [program]: the command's program, which the version command runs. */
export function fieldHelp(field: FormField, program: string): FieldHelp | null {
  const help = FIELD_HELP[field];
  if (!help) return null;
  return { ...help, empty: help.empty.replace('{program}', program || 'its program') };
}

/** The runtime switches in More settings: on, and when a package install brings the runtime itself. */
export const RUNTIME_ROWS: Record<'needsNode' | 'needsPython', { label: string; note: string; withPackage: string }> = {
  needsNode: {
    label: 'Needs Node.js 22',
    note: 'Node.js 22 or newer goes in first, on PATH for the script and the agent.',
    withPackage: 'Node.js 22 comes with the npm package.',
  },
  needsPython: {
    label: 'Needs Python 3.12',
    note: 'Python 3.12 and uv go in first, on PATH for the script and the agent.',
    withPackage: 'Python 3.12 and uv come with the Python package.',
  },
};

/** Under More settings while it is closed: what is in it. */
export const MORE_WHAT = 'Packages, runtimes, version check, the bell, chat title, messages hook.';

/** On the More settings row: how many of its fields are set; empty when none. */
export function moreCount(set: number): string {
  return set === 0 ? '' : `${set} set`;
}

/** The review's line under the ACP command, or for an agent without one. */
export function acpReviewLine(command: string | null): string {
  return command
    ? "Tasks that come while you're away (schedules, other agents' messages) run with this, with no screen."
    : 'None: scheduled tasks and messages start or reach its own app.';
}

/** What to set that hook to run, in the agent's own hook settings. */
export function messageHookCommand(event: string): string {
  return `In the agent's own hook settings, have its ${event} hook run: sh /root/.phonecando/bin/phonecando-inbox ${event}`;
}

const FAMILY_NAMES: Record<string, string> = {
  '*': 'Any OS',
  apt: 'apt (Debian, Ubuntu)',
  apk: 'apk (Alpine)',
  dnf: 'dnf (Fedora)',
  yum: 'yum (older Red Hat)',
  microdnf: 'microdnf (minimal Red Hat)',
  pacman: 'pacman (Arch)',
  zypper: 'zypper (openSUSE)',
  xbps: 'xbps (Void)',
};

export function familyName(family: string): string {
  return FAMILY_NAMES[family] ?? family;
}

/** `node>=22` → "Node.js 22 or newer", `python` → what our plugin installs; another runtime by its id. */
export function runtimeName(need: string): string {
  if (need === 'python') return 'Python 3.12 and uv';
  const [id, major] = need.split('>=');
  const name = id === 'node' ? 'Node.js' : id === 'python' ? 'Python' : id;
  return major ? `${name} ${major} or newer` : name;
}

/** A custom agent's line in the list: its id, then why it does not load or who uses it. */
export function kindLine(id: string, problem: string | null, agents: number): string {
  if (problem) return `${id} · Can't load: ${problem}`;
  if (agents === 0) return id;
  return `${id} · ${agents === 1 ? '1 agent' : `${agents} agents`}`;
}

export function inUseText(label: string, agents: readonly string[]): string {
  return `${label} is the kind of ${agents.join(', ')}. Delete ${agents.length === 1 ? 'that agent' : 'those agents'} first.`;
}

/** The problems about one field. */
export function fieldProblems(problems: readonly FormProblem[], field: FormField): string[] {
  return problems.filter((p) => p.field === field).map((p) => p.text);
}

/** The problems about no field in particular. */
export function otherProblems(problems: readonly FormProblem[]): string[] {
  return problems.filter((p) => p.field == null).map((p) => p.text);
}

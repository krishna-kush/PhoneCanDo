// The custom agent pages' words. Pure (zero RN imports): what we say about
// the risk before a save or an import, how a family and a runtime read, a
// row's line, a refused delete, and the problems the form shows under a
// field and above its button.
import type { FormField, FormProblem } from '../../../engine/agents/user/build.ts';

/** Said plainly before anything is saved or imported. */
export const SAFETY_LINES = [
  "A machine isn't a sandbox: what runs in it runs as this app, so it can reach the app's files and your other machines.",
  'The install script runs as root in the agent\'s machine, with network access.',
  "Importing someone else's agent runs their code on your phone. Read its script first.",
];

export const PHONE_TOOLS_ON =
  'Its machine gets PHONECANDO_BRIDGE_URL and PHONECANDO_BRIDGE_TOKEN. Point the agent at the MCP server ${PHONECANDO_BRIDGE_URL}/mcp with the header Authorization: Bearer ${PHONECANDO_BRIDGE_TOKEN}, in its config or its command.';

export const PHONE_TOOLS_OFF = 'Off: the agent never gets the bridge or its token.';

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

/** `node>=22` → "Node.js 22 or newer"; another runtime by its id. */
export function runtimeName(need: string): string {
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

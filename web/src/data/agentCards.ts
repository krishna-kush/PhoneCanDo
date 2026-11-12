// The Models section's agent cards (components/sections/models/), and every
// kind its copy names or counts: built in, default, stable, local, how far
// messages reach it and whether two can share a machine (the Crew and Linux
// sections; data/crew.ts). Build time only: the page prints every card, and
// the pack's script reads them back from the DOM, so no manifest ever
// reaches the browser. The cartridges are cartridges.ts.

/** The fields of an agent kind's agent.json a card shows. */
type Manifest = {
  id: string;
  label: string;
  type: 'native' | 'image';
  channels: string[];
  stability: string;
  /** The kind a fresh install starts with (at most one; agents/kit checks it). */
  default?: boolean;
  signIn?: { method: string }[];
  models?: Record<string, unknown>;
  /** How it reaches the phone tools; "none" (or left out) means it has none. */
  phoneTools?: string;
  /** How other agents' messages are pushed into its turns, and whether one can wake it. */
  inbox?: { wake?: string };
  /** Where a second agent of the kind on one machine keeps its own state. */
  state?: Record<string, unknown>;
};

/**
 * How far other agents' messages reach a kind, best first: pushed into its
 * turns and able to wake it, pushed in only, read only from its inbox, or
 * not at all. The wire names of agents/kit's MessagingLevel.
 */
export type MessagingLevel = 'wakes' | 'delivered' | 'inbox' | 'none';

// The kit's MessagingLevel.of, from the same three facts of the manifest.
const messaging = (m: Manifest): MessagingLevel =>
  m.inbox ? (m.inbox.wake ? 'wakes' : 'delivered') : (m.phoneTools ?? 'none') !== 'none' ? 'inbox' : 'none';

// Every agent kind, read from its own manifest, so the set never lists a
// kind we dropped or misses one we added. A kind with a `models` block can
// run on a local model; the rest bring their own sign-in.
const manifests = import.meta.glob<Manifest>('../../../agents/{native,image}/*/agent.json', {
  eager: true,
  import: 'default',
});

/** How a card's creature stands: the brand mark's poses (theme/logo.json). */
export type BotLook = {
  pose: 'square' | 'wide' | 'tall';
  /** The amber block in front, as the loader's swap frames have it. */
  swap: boolean;
  eyes: 'dot' | 'look' | 'sleepy' | 'wide';
  antenna: boolean;
};

export type AgentCard = {
  id: string;
  label: string;
  no: number;
  /** Built into the app (a native kind), not installed into a machine. */
  builtIn: boolean;
  /** The kind a fresh install starts with: the first card the first pack deals. */
  isDefault: boolean;
  stable: boolean;
  /** How it signs in, in a few words each. */
  signIn: string[];
  local: boolean;
  look: BotLook;
  messaging: MessagingLevel;
  /** Two of it can share one machine, each with its own state folder. */
  twins: boolean;
};

const SIGN_IN: Record<string, string> = {
  'api-key': 'API key',
  browser: 'browser',
  'device-code': 'device code',
  'paste-code': 'pasted code',
  'in-ui': 'in its web UI',
  'in-tui': 'in its TUI',
};

const POSES = ['square', 'wide', 'tall'] as const;
const EYES = ['dot', 'look', 'wide', 'sleepy'] as const;

// The default kind first, then the built-in ones, then by name. The first
// card wears the brand mark's own look; the rest step through the poses,
// eyes and swaps, so no two match.
const look = (i: number): BotLook => ({
  pose: POSES[i % 3],
  swap: Math.floor(i / 3) % 2 === 1,
  eyes: EYES[Math.floor(i / 2) % 4],
  antenna: i % 4 === 2,
});

const rank = (m: Manifest) => (m.default ? 0 : m.type === 'native' ? 1 : 2);

/** The kinds in the build the site hands out (full). */
export const cards: AgentCard[] = Object.values(manifests)
  .filter((m) => m.channels.includes('full'))
  .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
  .map((m, i) => ({
    id: m.id,
    label: m.label,
    no: i + 1,
    builtIn: m.type === 'native',
    isDefault: m.default === true,
    stable: m.stability === 'stable',
    signIn: (m.signIn ?? []).map((s) => SIGN_IN[s.method] ?? s.method),
    local: Boolean(m.models),
    look: look(i),
    messaging: messaging(m),
    twins: Boolean(m.state),
  }));

/** The kind a fresh install starts with; null if no manifest says. */
export const defaultCard = cards.find((c) => c.isDefault) ?? null;

/** The card every first pack holds: the default kind, else the first built in. */
export const firstPull = (defaultCard ?? cards.find((c) => c.builtIn) ?? cards[0])?.id ?? '';

/**
 * The kinds the lead names: the default, then these when agents/ has them
 * (the page never names a kind it does not have), four at most.
 */
const NAMED = ['claude-code', 'codex', 'gemini-cli'];
export const leadCards = [defaultCard, ...NAMED.map((id) => cards.find((c) => c.id === id))]
  .filter((c, i, all): c is AgentCard => c != null && all.indexOf(c) === i)
  .slice(0, 4);

// The Models section's booster pack (components/sections/models/). Build time
// only: the page prints every card, and the pack's script reads them back
// from the DOM, so no manifest ever reaches the browser.

/** The fields of an agent kind's agent.json a card shows. */
type Manifest = {
  id: string;
  label: string;
  type: 'native' | 'image';
  channels: string[];
  stability: string;
  signIn?: { method: string }[];
  models?: Record<string, unknown>;
};

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
  builtIn: boolean;
  stable: boolean;
  /** How it signs in, in a few words each. */
  signIn: string[];
  local: boolean;
  look: BotLook;
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

// Built in first, then by name. The first card wears the brand mark's own
// look; the rest step through the poses, eyes and swaps, so no two match.
const look = (i: number): BotLook => ({
  pose: POSES[i % 3],
  swap: Math.floor(i / 3) % 2 === 1,
  eyes: EYES[Math.floor(i / 2) % 4],
  antenna: i % 4 === 2,
});

/** The kinds in the build the site hands out (full). */
export const cards: AgentCard[] = Object.values(manifests)
  .filter((m) => m.channels.includes('full'))
  .sort((a, b) => (a.type === b.type ? a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }) : a.type === 'native' ? -1 : 1))
  .map((m, i) => ({
    id: m.id,
    label: m.label,
    no: i + 1,
    builtIn: m.type === 'native',
    stable: m.stability === 'stable',
    signIn: (m.signIn ?? []).map((s) => SIGN_IN[s.method] ?? s.method),
    local: Boolean(m.models),
    look: look(i),
  }));

/**
 * How many agents the page promises: a floor, so the copy stays true while
 * kinds come and go. The build fails if the set ever drops below it.
 */
const PROMISED = 13;
if (cards.length < PROMISED) {
  throw new Error(`The Models section promises ${PROMISED}+ agents, but agents/ has ${cards.length} kinds in the full build.`);
}
export const agentsClaim = `${PROMISED}+`;

/** The card every first pack holds: the one built into the app. */
export const firstPull = cards.find((c) => c.builtIn)?.id ?? '';

export type Cartridge = { id: string; name: string; note: string };

/** The cartridge in the phone when the page opens: any GGUF, not one of our picks. */
export const firstCartridge = 'gguf';

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

/**
 * The brains a card can run on, one in the phone at a time. The three
 * models are our suggestions, best first, with their file sizes, as
 * lme/catalog's Suggested.MODELS pins them; change them together.
 */
export const cartridges: Cartridge[] = [
  { id: 'qwen35-4b', name: 'Qwen3.5 4B', note: `${gb(2_740_937_888)} · our pick` },
  { id: 'gemma4-e2b', name: 'Gemma 4 E2B', note: `${gb(3_106_738_272)} · fastest` },
  { id: 'qwen35-9b', name: 'Qwen3.5 9B', note: `${gb(5_680_522_464)} · strongest` },
  { id: 'gguf', name: 'Any GGUF', note: 'Hugging Face or a file' },
];

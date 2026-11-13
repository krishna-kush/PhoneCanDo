// The Models section's agent cards (components/sections/models/), and every
// kind its copy names or counts: built in, default, stable, local, how far
// messages reach it and whether two can share a machine (the Crew and Linux
// sections; data/crew.ts), and how a scheduled task reaches it (the Schedules
// section; data/schedules.ts). Build time only: the page prints every card, and
// the pack's script reads them back from the DOM, so no manifest ever
// reaches the browser. The cartridges are cartridges.ts.

import { SHAPES } from '../../../mascot/body.ts';
import { DESIGNS, type DesignId } from '../../../mascot/designs.ts';
import type { Look } from '../../../mascot/look.ts';
import { hash } from '../lib/backdrop/seed';

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
  /** How its engine is started; a `prompt` block lets it start with a task. */
  engine?: { prompt?: unknown };
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

/**
 * How a scheduled task reaches a kind: it can be woken while idle (and
 * started), only started with the task, or neither. The kit's KindView
 * `schedules` is the last two together.
 */
export type ScheduleLevel = 'wakes' | 'starts' | 'none';

const schedules = (m: Manifest): ScheduleLevel => (m.inbox?.wake ? 'wakes' : m.engine?.prompt ? 'starts' : 'none');

// Every agent kind, read from its own manifest, so the set never lists a
// kind we dropped or misses one we added. A kind with a `models` block can
// run on a local model; the rest bring their own sign-in.
const manifests = import.meta.glob<Manifest>('../../../agents/{native,image}/*/agent.json', {
  eager: true,
  import: 'default',
});

/** A card's creature: its look (mascot/look.ts) and which way its eyes look. */
export type BotLook = Look & { eyes: 'dot' | 'look' | 'sleepy' | 'wide' };

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
  schedules: ScheduleLevel;
  /** It can set its own schedules (the schedule_* phone tools). */
  ownReminders: boolean;
};

const SIGN_IN: Record<string, string> = {
  'api-key': 'API key',
  browser: 'browser',
  'device-code': 'device code',
  'paste-code': 'pasted code',
  'in-ui': 'in its web UI',
  'in-tui': 'in its TUI',
};

const EYES = ['dot', 'look', 'wide', 'sleepy'] as const;

/**
 * The kinds the lead names: the default, then these when agents/ has them
 * (the page never names a kind it does not have), four at most.
 */
const NAMED = ['claude-code', 'codex', 'gemini-cli'];

/**
 * The lead kinds' designs (mascot/designs.ts), by the part each plays in
 * the backdrop's story (data/backdrop.ts, crewParts): the one who writes
 * the code, runs the tests, checks it twice, keeps watch.
 */
const CREW: DesignId[] = ['coder', 'tester', 'checker', 'watch'];

/** Everyone else's: any design but the crew's and the brand mark's own. */
const POOL = DESIGNS.map((d) => d.id).filter((id) => id !== 'plain' && !CREW.includes(id));

/**
 * Each of the other kinds' design, picked by its id, so a kind keeps its
 * design as kinds come and go; one already taken steps on to the next.
 */
function otherDesigns(ids: string[]): Map<string, DesignId> {
  const taken = new Set<DesignId>();
  const out = new Map<string, DesignId>();
  for (const id of ids) {
    let k = Math.floor(hash(id) * POOL.length);
    while (taken.has(POOL[k % POOL.length]) && taken.size < POOL.length) k++;
    const design = POOL[k % POOL.length];
    taken.add(design);
    out.set(id, design);
  }
  return out;
}

// The default kind first, then the built-in ones, then by name. The cards
// step through the shapes, inks and eyes, so no two match; the lead kinds
// wear the crew's designs, the rest one of their own.
const look = (i: number, design: DesignId): BotLook => ({
  design,
  shape: SHAPES[i % SHAPES.length],
  swap: Math.floor(i / SHAPES.length) % 2 === 1,
  eyes: EYES[Math.floor(i / 2) % 4],
});

const rank = (m: Manifest) => (m.default ? 0 : m.type === 'native' ? 1 : 2);

const full = Object.values(manifests)
  .filter((m) => m.channels.includes('full'))
  .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));

/** The lead's ids, in its order. */
const leadIds = [full.find((m) => m.default)?.id, ...NAMED]
  .filter((id, i, all): id is string => id != null && full.some((m) => m.id === id) && all.indexOf(id) === i)
  .slice(0, 4);
const others = otherDesigns(full.map((m) => m.id).filter((id) => !leadIds.includes(id)));

/** The kinds in the build the site hands out (full). */
export const cards: AgentCard[] = full
  .map((m, i) => ({
    id: m.id,
    label: m.label,
    no: i + 1,
    builtIn: m.type === 'native',
    isDefault: m.default === true,
    stable: m.stability === 'stable',
    signIn: (m.signIn ?? []).map((s) => SIGN_IN[s.method] ?? s.method),
    local: Boolean(m.models),
    look: look(i, leadIds.includes(m.id) ? CREW[leadIds.indexOf(m.id) % CREW.length] : (others.get(m.id) ?? 'plain')),
    messaging: messaging(m),
    twins: Boolean(m.state),
    schedules: schedules(m),
    ownReminders: schedules(m) !== 'none' && (m.phoneTools ?? 'none') !== 'none',
  }));

/** The kind a fresh install starts with; null if no manifest says. */
export const defaultCard = cards.find((c) => c.isDefault) ?? null;

/** The card every first pack holds: the default kind, else the first built in. */
export const firstPull = (defaultCard ?? cards.find((c) => c.builtIn) ?? cards[0])?.id ?? '';

/** The kinds the lead names, in its order: the default, then NAMED, four at most. */
export const leadCards = leadIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is AgentCard => c != null);

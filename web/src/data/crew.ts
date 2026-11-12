// The Crew section (components/sections/crew/): how far a note from another
// agent reaches each kind, who sits where on the floor plan, and the rules
// the runner's mailbox keeps. Every name and number is read from the code
// that has it: the kinds' manifests (agentCards.ts), the agents_* tools'
// definitions and the runner's MessageRules. Build time only, like
// agentCards.ts; the floor plan's script gets what it needs from the DOM.
import { cards, type AgentCard, type MessagingLevel } from './agentCards';
import messageRules from '../../../app/modules/phonecando-runner/android/src/main/java/com/phonecando/runner/messages/MessageRules.kt?raw';
import agentTools from '../../../agents/shared/phone-tools/agents.ts?raw';

const rule = (name: string): number => {
  const found = messageRules.match(new RegExp(`const val ${name} = (\\d+)`));
  if (!found) throw new Error(`MessageRules.kt has no ${name}; data/crew.ts reads it for the Crew section.`);
  return Number(found[1]);
};

/** Times one agent may be woken by messages in an hour. */
export const wakesPerHour = rule('WAKES_PER_HOUR');

/** A note this many hops deep (a reply to a reply) never wakes anyone. */
export const noWakeHop = rule('NO_WAKE_HOP');

/** The phone tools agents message each other with, in the order they are defined. */
export const messageTools = [...agentTools.matchAll(/name:\s*["'](agents_\w+)["']/g)].map((m) => m[1]);
if (messageTools.length === 0) throw new Error('agents/shared/phone-tools/agents.ts names no agents_* tool.');

const LEVELS: { level: MessagingLevel; title: string; meaning: string }[] = [
  {
    level: 'wakes',
    title: 'Wakes',
    meaning: 'Gets notes during its runs and at its next turn. A note that asks can wake it.',
  },
  {
    level: 'delivered',
    title: 'Delivered',
    meaning: 'Gets notes during its runs and at its next turn. Never woken.',
  },
  {
    level: 'inbox',
    title: 'Inbox only',
    meaning: 'Nothing pushed: it reads its notes when it checks.',
  },
  {
    level: 'none',
    title: 'No messages',
    meaning: 'No phone tools, so it can’t read or send them. Notes to it are refused.',
  },
];

/** The four levels, best first, each with what it means and the kinds at it. */
export const levels = LEVELS.map((l) => ({ ...l, kinds: cards.filter((c) => c.messaging === l.level) }));

/** The kinds whose second agent on one machine gets its own state folder. */
export const twinKinds = cards.filter((c) => c.twins);

// The floor plan's agents: the first kind at each level (the default first,
// as the cards are ordered), plus a second that wakes, so two can wake each
// other until the hop limit stops them. The second waker shares a machine
// with the first that is only delivered to; the rest get one each, as we
// recommend. A level no kind is at leaves its seat out.
export type Seat = {
  card: AgentCard;
  /** Busy on your task when the page opens; idle otherwise. */
  working: boolean;
  /** A job it left running in the background, which keeps it up while you're away. */
  job?: string;
  /** Keep running is on: it stays up while you're away, idle or not. */
  kept?: boolean;
};

const at = (level: MessagingLevel) => cards.filter((c) => c.messaging === level);
const [waker, waker2] = at('wakes');
const [delivered] = at('delivered');
const [inboxOnly] = at('inbox');
const [deaf] = at('none');

const seat = (card: AgentCard | undefined, s: Omit<Seat, 'card'>): Seat[] => (card ? [{ card, ...s }] : []);

/** The machines on the phone, each with the agents in it. */
export const rooms: Seat[][] = [
  [...seat(waker2, { working: false }), ...seat(delivered, { working: false, job: 'npm run dev' })],
  seat(waker, { working: false, kept: true }),
  seat(inboxOnly, { working: true }),
  seat(deaf, { working: true }),
].filter((room) => room.length > 0);

export const seatCount = rooms.flat().length;

const present = (list: (AgentCard | undefined)[]) => list.filter((c): c is AgentCard => c != null);

/**
 * The screen's line (FIG. 05B), from the plan's agents that have phone tools
 * (one without can't drive the screen): one drives, one waits, two sit it out.
 * The second waker was just woken by a note, and a turn a note started can't
 * take the screen.
 */
export const screenLine = {
  holder: waker ?? null,
  waiting: present([delivered]),
  bench: present([waker2, inboxOnly]),
  woken: waker2?.id ?? '',
};

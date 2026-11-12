// What a note does when it reaches an agent on the floor plan
// (components/sections/crew/FloorPlan.astro): the runner's own rules
// (MessagePolicy, MessageRules) in the toy's terms, with the stamp it lands
// with. Pure: no DOM.

export type Level = 'wakes' | 'delivered' | 'inbox' | 'none';
export type SeatState = 'working' | 'idle' | 'stopped';

/** The two numbers the runner keeps (data/crew.ts reads them from MessageRules.kt). */
export type Limits = { wakesPerHour: number; noWakeHop: number };

export type Target = {
  level: Level;
  state: SeatState;
  /** "Other agents can wake it" is on. */
  wakeable: boolean;
  /** Times it was woken this hour. */
  wakes: number;
};

/** A note: how many woken turns deep it was sent, and whether it went to everyone. */
export type Note = { hop: number; broadcast: boolean };

/** Where a note ends up: read now, woke its agent, in its pile for later, or back with its sender. */
export type Lands = 'read' | 'woke' | 'pile' | 'refused';

export type Why =
  | 'no-tools'
  | 'inbox'
  | 'stopped'
  | 'mid-run'
  | 'next-turn'
  | 'broadcast'
  | 'switch-off'
  | 'hop'
  | 'budget'
  | 'woke';

export function land(to: Target, note: Note, limits: Limits): { lands: Lands; why: Why } {
  if (to.level === 'none') return { lands: 'refused', why: 'no-tools' };
  if (to.level === 'inbox') return { lands: 'pile', why: 'inbox' };
  if (to.state === 'stopped') return { lands: 'pile', why: 'stopped' };
  if (to.state === 'working') return { lands: 'read', why: 'mid-run' };
  if (to.level === 'delivered') return { lands: 'pile', why: 'next-turn' };
  if (note.broadcast) return { lands: 'pile', why: 'broadcast' };
  if (!to.wakeable) return { lands: 'pile', why: 'switch-off' };
  if (note.hop >= limits.noWakeHop) return { lands: 'pile', why: 'hop' };
  if (to.wakes >= limits.wakesPerHour) return { lands: 'pile', why: 'budget' };
  return { lands: 'woke', why: 'woke' };
}

/** The rubber stamp a note lands with: a word or two, and the reason under it. */
export function stampFor(why: Why, limits: Limits): [head: string, sub: string] {
  switch (why) {
    case 'woke':
      return ['Woken', 'starts a turn to answer'];
    case 'mid-run':
      return ['Delivered', 'mid-run'];
    case 'next-turn':
      return ['Next turn', 'never woken'];
    case 'inbox':
      return ['Inbox', 'reads it when it checks'];
    case 'no-tools':
      return ['Refused', 'no phone tools'];
    case 'stopped':
      return ['Stopped', 'a note won’t start it'];
    case 'broadcast':
      return ['Next turn', 'notes to all never wake'];
    case 'switch-off':
      return ['Do not wake', 'its switch is off'];
    case 'hop':
      return ['No more wakes', 'a reply to a reply'];
    case 'budget':
      return [`${limits.wakesPerHour} wakes/hr`, 'used up · next turn'];
  }
}

/** The screen reader's line for a note that reached [name]. */
export function sayLanded(name: string, from: string, why: Why, limits: Limits): string {
  switch (why) {
    case 'woke':
      return `${from}'s note woke ${name}, which starts a turn to answer.`;
    case 'mid-run':
      return `${name} got ${from}'s note in the middle of its run.`;
    case 'next-turn':
      return `${name} is idle and is never woken: it gets ${from}'s note at its next turn.`;
    case 'inbox':
      return `${from}'s note waits in ${name}'s inbox until it checks.`;
    case 'no-tools':
      return `${name} has no phone tools, so ${from}'s note was refused.`;
    case 'stopped':
      return `${name} is stopped, and a note never starts a stopped agent: it waits.`;
    case 'broadcast':
      return `${name} gets ${from}'s note to everyone at its next turn: notes to all never wake.`;
    case 'switch-off':
      return `${name}'s switch says other agents can't wake it: the note waits for its next turn.`;
    case 'hop':
      return `${from}'s note is a reply to a reply, which never wakes anyone: it waits for ${name}'s next turn.`;
    case 'budget':
      return `${name} was woken ${limits.wakesPerHour} times this hour, the most it can be: the note waits for its next turn.`;
  }
}

// What the app says about presence: an agent's status line beside its name
// (Home's header, its drawer row) and Home's hand-over card, which says
// who has the phone and offers the way back. Pure (zero RN imports):
// scripts/vectors/test_presence.js checks it.
import type { AgentStatus, HandOver, StatusMood, UserAct } from '../../engine/presence/types';

/** A shell-ish mark before the line, by its mood: a prompt at work, dots mulling it over, a pause waiting. */
const LEAD: Record<StatusMood, string> = { working: '>', thinking: '…', waiting: '‖' };

const MOOD_WORD: Record<StatusMood, string> = { working: 'working', thinking: 'thinking', waiting: 'waiting' };

/** The line as shown, its mark first: "> running the tests". */
export function statusText(status: AgentStatus): string {
  return `${LEAD[status.mood]} ${status.text}`;
}

/** The line for a screen reader: "thinking: which test broke". */
export function statusLabel(status: AgentStatus): string {
  return `${MOOD_WORD[status.mood]}: ${status.text}`;
}

export type CardButton = { label: string; act: UserAct; variant: 'primary' | 'ghost' };

export type HandOverCopy = {
  /** Who has what, in words. */
  title: string;
  /** What it means for the agent. */
  line: string;
  /** Left to right; the one that ends it as asked on the right. */
  buttons: CardButton[];
  /** The face's mood: watching you, or asleep while it is paused. */
  mood: 'awake' | 'asleep';
};

// The agent's reason as a sentence of its own.
const sentence = (why: string) => (/[.!?…]$/.test(why) ? why : `${why}.`);

/**
 * The card for [h]. Watch: you drive while the agent still sees the
 * screen; "Your turn" hands it back. Paused: it can't see or touch the
 * phone, and its other work goes on; "Start me again" hands the phone
 * back (a note to go on if it is not waiting), "Leave it" closes the
 * pause with no note (its next run drives as usual).
 */
export function handOverCopy(h: HandOver): HandOverCopy {
  const name = h.agentName;
  if (h.mode === 'watch') {
    return {
      title: h.why ? `${name} handed you the phone: ${h.why}` : 'You have the controls',
      line: `${name} watches while you drive. Done? Hand it back.`,
      buttons: [{ label: 'Your turn', act: 'GIVE_BACK', variant: 'primary' }],
      mood: 'awake',
    };
  }
  return {
    title: `${name} is paused`,
    line: `${h.why ? `${sentence(h.why)} ` : ''}It can't use the phone until you start it again.`,
    buttons: [
      { label: 'Leave it', act: 'LEAVE', variant: 'ghost' },
      { label: 'Start me again', act: 'START_AGAIN', variant: 'primary' },
    ],
    mood: 'asleep',
  };
}

/** The card for a screen reader, all in one. */
export function handOverLabel(h: HandOver): string {
  const c = handOverCopy(h);
  return `${c.title}. ${c.line}`;
}

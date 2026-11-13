// Every line of the first shift: the hello, the Home card, the page, each
// mission and the finale. A-01's captions sit beside the plain words, never
// in place of them (common/face/lines.ts). Pure (zero RN imports).
import type { MissionId } from '../../state/logic/starter/missions.ts';
import type { DareSet } from './logic/dares.ts';

/** What the words depend on. */
export type StarterContext = {
  /** The agent runs in a Linux machine (else Android's own shell). */
  linux: boolean;
  /** Local models are offered on this phone (the drawer's Models). */
  models: boolean;
};

export const SHIFT_TITLE = 'First shift';

export function shiftKicker(done: number, total: number): string {
  return `first shift · ${done}/${total}`;
}

// --- the hello -----------------------------------------------------------------

export function helloTitle(name: string): string {
  return `Hi, I'm ${name}!`;
}

export function helloLine(hands: boolean): string {
  return hands
    ? 'Your first agent. I live on this phone: I write code, run Linux, and once you say so, tap through your apps.'
    : 'Your first agent. I live on this phone: I write code, run commands and build things for you.';
}

export const RENAME = 'Call me something else';
export const RENAME_TITLE = 'Name your agent';
export const RENAME_CONFIRM = 'Name it';

export function helloShift(count: number): string {
  return `Up for a quick first shift? ${count} short jobs, about 3 minutes. Skip any of them.`;
}

export const START = 'Start shift';
export const WING_IT = "I'll wing it";
export const LATER_NOTE = 'The first shift waits in About whenever you want it.';

/** Under the face while the agent starts, then once it is up. */
export function helloCaption(serial: string, up: boolean): string {
  return `${serial} · ${up ? 'reporting for duty' : 'waking up'}`;
}

// --- the Home card and the drawer row -------------------------------------------

export function cardLine(next: string | null): string {
  return next ? `Next: ${next}` : 'All stamped! See how you did';
}

export const OPEN_CARD = 'Open the first shift';

export function rowDetail(done: number, total: number): string {
  return `${done}/${total}`;
}

// --- the page ---------------------------------------------------------------

/** Beside A-01 atop the page; one per opening. */
const PAGE_LINES = ['training day', 'teach me things', "let's do this", 'clipboard ready', 'on the job'];

export function pageLine(seed: number): string {
  return PAGE_LINES[Math.abs(Math.floor(seed)) % PAGE_LINES.length];
}

export const PAGE_LEAD = 'A few real jobs, done right here in the app. Each gets a stamp when I see it happen.';

export const DONE_STAMP = 'done';
export const SKIPPED = 'skipped';
export const TRY_IT = 'Try it';
export const SKIP = 'Skip';
export const SHOW_HOW = 'Show me how';
export const NEXT = 'Next';
export const WHERE = 'Where';
export const ROLL = 'Roll';
export const COPY_DARE = 'Copy';
export const COPIED = 'Copied! Paste it in the chat.';
export const COPY_FAILED = "Couldn't copy it. Type it in the chat instead.";
export const SKIP_ALL = 'Skip the whole shift';
export const START_OVER = 'Start over';

/** The dice box's label, by what the dare is for. */
export function dareLabel(set: DareSet): string {
  if (set === 'shell') return 'Roll a command';
  return 'Roll a dare';
}

export type MissionCopy = {
  title: string;
  /** What it is. */
  what: string;
  /** Where it lives in the app. */
  where: string;
  /** How, step by step: at once on a short mission, after Show me how on a long one. */
  steps: string[];
  /** The button that takes you there. */
  go: string;
  /** The dares it offers, if any. */
  dares?: DareSet;
};

const NAME_TAP = 'Tap my name (top left)';

export function missionCopy(id: MissionId, c: StarterContext): MissionCopy {
  switch (id) {
    case 'hello':
      return {
        title: 'Say hi',
        what: 'Home is my chat. Ask for anything and I do it right here, on this phone.',
        where: 'Home: the chat under my name',
        steps: [
          c.models
            ? 'If the chat asks for a model, pick one: sign in to a provider there, or get one that runs on this phone (tap my name, then Models).'
            : 'If the chat asks for a model, pick one there: sign in to a provider.',
          'Roll a dare, then paste it in the chat and send it.',
        ],
        go: 'Copy it, open chat',
        dares: 'chat',
      };
    case 'terminal':
      return {
        title: 'Peek under the hood',
        what: c.linux
          ? 'I live in a real Linux machine (Debian) inside this phone. Its terminal is yours too.'
          : "I work in Android's own shell on this phone. Its terminal is yours too.",
        where: c.linux
          ? '⋮ (top right) → Agent settings → Open terminal in the machine'
          : '⋮ (top right) → Agent settings → Open terminal',
        steps: ["Roll a command, open the terminal and press Enter. It's typed in for you."],
        go: 'Open terminal with it',
        dares: 'shell',
      };
    case 'hands':
      return {
        title: 'Give me hands',
        what:
          'Phone control lets me read the screen, tap and type for you: "set a timer", "reply to that". ' +
          "It's off until you switch it on, and I touch nothing until you unlock me with your fingerprint.",
        where: `${NAME_TAP} → Settings → Phone control`,
        steps: [
          'Open Phone control and follow its steps to switch me on. Android double-checks, so it takes a few taps.',
          'Then copy a dare and paste it in the chat.',
        ],
        go: 'Open Phone control',
        dares: 'hands',
      };
    case 'upgrade':
      return {
        title: 'Want hands?',
        what:
          'This is the starter build: I can think, code and run Linux. The full build also lets me read your screen, tap and type for you.',
        where: `${NAME_TAP} → Settings → Updates`,
        steps: ['The full build installs over this one in one tap and keeps everything you have here.'],
        go: 'See the full build',
      };
    case 'teammate':
      return {
        title: 'Hire a teammate',
        what: c.linux
          ? 'More agents, more hands. Add Claude Code, Gemini CLI and more: each gets its own face, and we can message each other.'
          : 'More agents, more hands. Add another one: it gets its own chats and its own face, and we can message each other.',
        where: `${NAME_TAP} → New agent`,
        steps: c.linux
          ? [
              `${NAME_TAP}, then New agent.`,
              'Pick one, then where it lives: its own machine (best), or sharing mine.',
              'Some ask you to sign in to their own account the first time.',
            ]
          : [`${NAME_TAP}, then New agent.`, 'Pick one, and it gets ready.'],
        go: 'Open New agent',
      };
    case 'schedule':
      return {
        title: 'Night shift',
        what:
          'Give me a job for later, like "every morning at 8, sum up my notes". I wake up and do it, even after a reboot.',
        where: `${NAME_TAP} → Schedules`,
        steps: [
          'Open Schedules and tap Add.',
          'Pick me, write the job and set the time.',
          'Or just ask me in the chat: "remind me at 6 to stretch".',
        ],
        go: 'Open Schedules',
      };
  }
}

// --- the finale -------------------------------------------------------------

export const FINALE_TITLE = 'Shift done!';
export const FINALE_STAMP = 'certified crew';
export const FINALE_CAPTION = 'end of manual';
export const FINALE_LINE = "You know your way around now. I'm in the chat whenever you need me.";

export const REWARD_EARNED = 'You earned the Shift lead look: a hard hat and a medal, for keeps.';
export const PUT_IT_ON = 'Put it on';
export const WEARING_IT = 'Looking sharp!';

export function rewardOwed(skipped: number): string {
  const jobs = skipped === 1 ? 'the skipped job' : `the ${skipped} skipped jobs`;
  return `Finish ${jobs} to earn the Shift lead look: a hard hat and a medal.`;
}

export const BACK_TO_WORK = 'Back to work';

// --- elsewhere --------------------------------------------------------------

/** The Mascot page's reward while it is not earned yet. */
export function lockedLabel(name: string): string {
  return `${name} · locked`;
}

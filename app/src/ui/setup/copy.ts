// First launch's words: the title, the note, and the arcade scene's
// headlines, levels and tips. Pure (zero RN imports). On play there is no
// Linux, so the screen never mentions it there.
import type { SetupPath } from '../../state/flows/firstLaunch';

export type SetupContext = {
  path: SetupPath;
  play: boolean;
  /** Why Linux is off: unavailable in this build, or the user chose to go on without it. */
  noLinux: 'unavailable' | 'skipped' | null;
};

export function setupTitle({ path }: SetupContext): string {
  return path === 'linux' ? 'Setting up your Linux machine' : 'Getting your agent ready';
}

export function setupNote({ path, play, noLinux }: SetupContext): string | null {
  if (path === 'linux') return 'Takes about half a minute, and only ever this once. No internet needed.';
  if (play) return null;
  if (noLinux === 'unavailable') return "Linux isn't available in this build, so your agent uses Android's own shell.";
  if (noLinux === 'skipped') return "Your agent uses Android's own shell. You can add a Linux agent later: tap its name up top, then New agent.";
  return null;
}

/** Each stage's short name, for the track's levels. */
export const STAGE_SHORT = ['Unpack', 'Detect', 'Set up', 'Start'] as const;

/** Arcade: the headline as it goes, ends or stops, the once-only level's tag, the player line, the clock and the tips. */
export const ARCADE = {
  loading: 'Now loading',
  clear: 'Stage clear!',
  stopped: 'Continue?',
  /** Under the headline while the machine unpacks: first launch runs once ever (App's `setUp`). */
  once: { tag: 'Once only', line: 'Bonus level: it never replays.' },
  player: (name: string) => `Player 1 · ${name}`,
  time: 'Time',
  tip: 'Tip',
  tips: [
    'No internet needed for this part.',
    "Tap your agent's name up top for the menu.",
    'Want another agent? Menu, then New agent.',
    'Your agent gets a real Linux system: it can install the tools it needs.',
    'Agents can message each other and run tasks on a schedule.',
    "Your agent's face is yours to change: its page, then Mascot.",
    'Phone control lets your agent use your phone, once you turn it on in Settings.',
  ],
} as const;

// First launch's words. Pure (zero RN imports). On play there is no Linux,
// so the screen never mentions it there.
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
  if (path === 'linux') return 'Takes about half a minute. No internet needed.';
  if (play) return null;
  if (noLinux === 'unavailable') return "Linux isn't available in this build, so your agent uses Android's own shell.";
  if (noLinux === 'skipped') return "Your agent uses Android's own shell. You can add a Linux env later in the Env tab.";
  return null;
}

export const CHOOSE_TITLE = 'Choose your agent';

/** Over Choose agent: what the pick means here (never Linux on play). */
export function chooseNote({ path, play }: SetupContext): string {
  const pick = 'Pick the agent to set up first; you can add more in the Env tab.';
  if (path === 'linux') return `${pick} It gets its own Linux machine.`;
  return play ? pick : `${pick} It uses Android's own shell, so agents that need Linux can't run.`;
}

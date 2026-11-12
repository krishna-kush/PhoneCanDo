// The phone-control lock's modes in words: the picker's choices, what each
// does, the Settings card and the unlock dialog's line on how long an
// unlock lasts. Pure (zero RN imports).
import type { LockMode } from '../../engine/runner';

export const LOCK_MODES: readonly LockMode[] = ['install', 'launch', 'ask'];

/** The picker's heading: what the modes choose between. */
export const PICKER_LABEL = 'Ask for your fingerprint or PIN';

export const MODE_LABEL: Record<LockMode, string> = {
  install: 'Once',
  launch: 'Each launch',
  ask: 'Each ask',
};

/** What the picked mode does, under the picker. */
export const MODE_NOTE: Record<LockMode, string> = {
  install: 'Unlock once and it stays unlocked, across restarts, until you lock it here.',
  launch:
    'Unlock again each time PhoneCanDo starts, including after you swipe it away from recent apps.',
  ask: 'Each agent asks when it needs the phone, and its unlock is its own. It ends when the agent hands the phone back, stops, or goes 5 minutes without using it.',
};

/** Under the lock button while locked, in install and launch modes. */
export const UNLOCK_WHY =
  "Why unlock? It's your yes: agents can see and tap your phone only while it's unlocked.";

/** Settings' card for the lock as it stands. */
export function lockCard(
  mode: LockMode,
  unlocked: boolean,
  asking: number,
): { title: string; subtitle: string } {
  if (mode === 'ask') {
    if (asking > 0) {
      return {
        title: asking === 1 ? '1 agent unlocked' : `${asking} agents unlocked`,
        subtitle: 'Each has its own unlock until it hands the phone back.',
      };
    }
    return { title: 'Locked', subtitle: 'An agent asks for your fingerprint or PIN when it needs the phone.' };
  }
  if (!unlocked) {
    return { title: 'Locked', subtitle: 'Unlock with your fingerprint or PIN before agents can act on the phone.' };
  }
  return {
    title: 'Unlocked',
    subtitle:
      mode === 'install'
        ? 'Agents can act on the phone until you lock it.'
        : 'Agents can act on the phone until you lock it or close PhoneCanDo.',
  };
}

/** The unlock dialog's line on how long this unlock lasts. */
export function unlockLasts(mode: LockMode, agentName: string): string {
  if (mode === 'ask') return `This unlock is for ${agentName} alone and ends when it hands the phone back.`;
  if (mode === 'launch') return 'It stays unlocked for every agent until you close PhoneCanDo.';
  return 'It stays unlocked for every agent until you lock it in Settings.';
}

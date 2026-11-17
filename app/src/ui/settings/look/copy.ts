// Settings → Look & feel in words and numbers: the three theme screens'
// names and A-01's mood on each, the extra keys' two choices, and how far
// the preview's keys row rides as the keyboard goes down. Pure (zero RN
// imports).
import type { ThemeMode } from '../../../state/app/prefs';
import { REACTION } from '../../common/face/change/specs.ts';
import { changeMs } from '../../common/face/change/timing.ts';

export type Scheme = 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

/** A theme screen's name, under it. */
export const THEME_LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/** The scheme a theme mode paints now: system follows the phone. */
export function schemeOf(mode: ThemeMode, phone: Scheme): Scheme {
  return mode === 'system' ? phone : mode;
}

/** A-01 on a theme's screen: up with the lights on, napping with them off. */
export function moodOf(mode: ThemeMode, phone: Scheme): 'awake' | 'asleep' {
  return schemeOf(mode, phone) === 'light' ? 'awake' : 'asleep';
}

/** The picked theme's line, under the screens. */
export function themeLine(mode: ThemeMode, phone: Scheme): string {
  if (mode === 'system') return `Follows your phone · ${phone === 'light' ? 'lights on' : 'lights off'} now`;
  return mode === 'light' ? 'Lights on · A-01 is up' : 'Lights off · A-01 naps';
}

export type KeysChoice = { sticky: boolean; title: string; note: string };

export const KEYS_CHOICES: readonly KeysChoice[] = [
  { sticky: false, title: 'With the keyboard', note: 'The row comes up with the keyboard and goes down with it.' },
  {
    sticky: true,
    title: 'Always up',
    note: 'Stays up with the keyboard down, so you can still scroll and move around a program while reading.',
  },
];

/**
 * How far the preview's keys row moves down as the keyboard goes down
 * (`down` 0 up to 1 gone): with the keyboard it rides all the way out
 * with it; always up it stops at the screen's foot, in view.
 */
export function rowDrop(down: number, sticky: boolean, keyboardH: number, rowH: number): number {
  'worklet';
  return down * (sticky ? keyboardH : keyboardH + rowH);
}

/**
 * The theme sweep's beats, in ms: its colour's spread over the app, its
 * fade, and the beat A-01 holds once its reaction is done before the
 * colour lifts: lights on, eyes open; lights off, the nap (shut eyes, the
 * drifting z).
 */
export const SWEEP = { growMs: 280, fadeMs: 240, afterMs: { light: 130, dark: 400 } } as const;

/** The least time the sweep covers the app from the tap, however fast the theme goes in under it: A-01's reaction, then its beat. */
export function sweepHold(scheme: Scheme): number {
  return changeMs(REACTION[scheme === 'light' ? 'glare' : 'startle']) + SWEEP.afterMs[scheme];
}

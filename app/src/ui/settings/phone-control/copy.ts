// The top of Settings in words: A-01's line on its board, and the phone
// control panel's status (A-01's mood, its stamp and its caption), read
// from the two keys below it: Android's Accessibility switch and our lock.
// Agents see and tap the phone only with both turned, so the status never
// says more than the two rows do. Pure (zero RN imports).
import { boopLine, settingsLine } from '../../common/face/lines.ts';

export const PANEL_TITLE = 'Phone control';

/** A-01's line on the board: its settings line, then a boop line for each tap. */
export function boardLine(seed: number, boops: number): string {
  return boops > 0 ? boopLine(boops - 1) : settingsLine(seed);
}

/** How far the keys are turned: off (no Accessibility), starting, ready (on but locked) or on. */
export type HandsLevel = 'off' | 'starting' | 'ready' | 'on';

/** The level from the switch (`enabled`), the service (`connected`) and the lock (`open`). */
export function handsLevel(enabled: boolean, connected: boolean, open: boolean): HandsLevel {
  if (!enabled) return 'off';
  if (!connected) return 'starting';
  return open ? 'on' : 'ready';
}

/** A-01's face for the level: asleep while off, looking about while it starts, awake once ready. */
export function handsMood(level: HandsLevel): 'asleep' | 'busy' | 'awake' {
  if (level === 'off') return 'asleep';
  if (level === 'starting') return 'busy';
  return 'awake';
}

/** The stamp beside A-01. */
export const HANDS_STAMP: Record<HandsLevel, string> = {
  off: 'off duty',
  starting: 'clocking in',
  ready: 'locked',
  on: 'on duty',
};

/** A-01's caption: what the two keys add up to, in its voice (ask mode: each agent asks for itself). */
export function handsLine(level: HandsLevel, asks: boolean): string {
  switch (level) {
    case 'off':
      return 'eyes shut · Accessibility is off';
    case 'starting':
      return 'waking up · Accessibility is starting';
    case 'ready':
      return asks ? 'ready · each agent asks you first' : 'ready · locked until you unlock';
    case 'on':
      return 'eyes and hands on';
  }
}

/** Builds without phone control (lite, play): the stamp, and the plain line as it always read. */
export function noHandsStamp(channel: string): string {
  return `not in ${channel}`;
}

export function noHandsLine(channel: string): string {
  return `This ${channel} build has no screen automation. Notifications, clipboard, and opening links still work.`;
}

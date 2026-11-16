// A face's moving parts as styles at one moment of their loops, shared by
// the live face (as worklets, on the UI thread) and the still one (once, at
// rest). Pure (zero RN imports); each style is a worklet, as anything a
// worklet imports must be.

/** How open the eyes are for each mood (1 open, down to nearly shut). */
export const LID = { awake: 1, busy: 1, asleep: 0.15, oops: 0.45, sweaty: 1, happy: 1 } as const;

/** A pixel heart, row by row (happy), like the logo built from squares. */
export const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
/** One heart's loop, and the part of it spent rising (the rest is a pause). */
export const HEART_MS = 2300;
export const HEART_RISE = 0.78;
/** Each heart's sideways place, in heart widths from the first (up to three). */
export const HEART_SHIFT = [0, -0.75, -0.35];

/** Where each loop rests on a face that does not move: no hop, eyes ahead, the "z" or drop halfway, one heart halfway up. */
export const REST = { lift: 0, look: 0, drift: 0.5, beat: HEART_RISE / 2 } as const;

// [x] along the points [from], mapped onto [to] in straight lines between
// them, as Reanimated's interpolate (every loop stays inside [from]).
function along(x: number, from: readonly number[], to: readonly number[]): number {
  'worklet';
  let i = 1;
  while (i < from.length - 1 && x > from[i]) i++;
  const span = from[i] - from[i - 1];
  const k = span === 0 ? 0 : (x - from[i - 1]) / span;
  return to[i - 1] + (to[i] - to[i - 1]) * k;
}

/** A tap's hop: the whole figure lifted by [lift] dp. */
export function liftStyle(lift: number) {
  'worklet';
  return { transform: [{ translateY: lift }] };
}

/** An eye [lid] open. */
export function lidStyle(lid: number) {
  'worklet';
  return { transform: [{ scaleY: lid }] };
}

/** The pupils looking [look] of the way to a side (-1 to 1) in an eye [eyeW] wide (mascot/layout/eyes.ts). */
export function pupilStyle(look: number, eyeW: number) {
  'worklet';
  return { transform: [{ translateX: look * eyeW * 0.22 }] };
}

/** Asleep: the "z" [drift] of the way up its float, fading in and out. */
export function zStyle(drift: number, mark: number) {
  'worklet';
  return {
    opacity: along(drift, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ translateY: along(drift, [0, 1], [mark * 0.4, -mark * 0.4]) }],
  };
}

/** Sweaty: the drop [drift] of the way down its run, turned so its corner points up. */
export function dropStyle(drift: number, mark: number) {
  'worklet';
  return {
    opacity: along(drift, [0, 0.15, 0.75, 1], [0, 1, 1, 0]),
    transform: [{ translateY: along(drift, [0, 1], [0, mark * 0.8]) }, { rotate: '45deg' }],
  };
}

/** Happy: a heart [h] tall, its turn [phase] of the way into the shared loop at [beat]: rising off the head and fading, then waiting out the rest. */
export function heartStyle(beat: number, phase: number, h: number) {
  'worklet';
  const p = (beat + phase) % 1;
  const life = Math.min(1, p / HEART_RISE);
  const eased = 1 - (1 - life) * (1 - life);
  return {
    opacity: p >= HEART_RISE ? 0 : along(life, [0, 0.25, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ translateY: along(eased, [0, 1], [h * 0.4, -h * 0.8]) }],
  };
}

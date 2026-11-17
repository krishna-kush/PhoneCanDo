// A face's moving parts as styles at one moment of their loops, shared by
// the live face (as worklets, on the UI thread) and the still one (once, at
// rest). Pure (zero RN imports); each style is a worklet, as anything a
// worklet imports must be.

/**
 * How open the eyes are for each mood (1 open, down to nearly shut). Happy
 * shuts them in its smile (drawn as brackets), so its lids only show as a
 * face changes to or from it: they squint shut into the smile.
 */
export const LID = { awake: 1, busy: 1, asleep: 0.15, oops: 0.45, sweaty: 1, happy: 0.15 } as const;

/** Where the pupils rest for each mood, as a gaze (-1 to 1, as pupilStyle takes it): awake a little to the right, as the site's do. */
export const LOOK = { awake: 0.5, busy: 0, asleep: 0, oops: 0, sweaty: 0, happy: 0 } as const;

/** A while [r] (0 to 1) of the way from [lo] to [hi] ms: each face picks its own rhythm in a range. */
export function between([lo, hi]: readonly [number, number], r: number): number {
  return lo + r * (hi - lo);
}

/** How often awake blinks, in ms: each face picks its own between these. */
export const BLINK_EVERY_MS = [2400, 6000] as const;

/**
 * Awake's glances now and then: each face waits its own while (picked
 * between `everyMs`), looks to a side (a gaze of `to`, left first), holds,
 * and comes back to rest; the next one goes the other way. `to` is past a
 * pupil's reach, so the eyes turn with each glance and the right one shows
 * as well as the left, though awake's pupils already rest to the right.
 */
export const GLANCE = { everyMs: [3000, 6500], moveMs: 200, holdMs: 650, to: 2 } as const;

/** How far a pupil goes in its eye, as a gaze (it is half the eye wide); a gaze past it turns the eyes the rest of the way. */
export const PUPIL_REACH = 1.1;

/** How far a gaze of 1 moves a pupil, in eye widths. */
const GAZE_W = 0.22;

// [look] held to the pupil's reach.
function reached(look: number): number {
  'worklet';
  return Math.max(-PUPIL_REACH, Math.min(PUPIL_REACH, look));
}

/** A pixel heart, row by row (happy), like the logo built from squares. */
export const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
/** One heart's loop, and the part of it spent rising (the rest is a pause). */
export const HEART_MS = 2300;
export const HEART_RISE = 0.78;
/** Each heart's sideways place, in heart widths from the first (up to three). */
export const HEART_SHIFT = [0, -0.75, -0.35];

/** Asleep's "z": one float up, and the wait before the next. */
export const Z_FLOAT_MS = 1800;
export const Z_WAIT_MS = 500;
/** How far along its float the "z" is first seen in full: a change into asleep starts it there, never from unseen. */
export const Z_SHOWN = 0.2;

/** Where each loop rests on a face that does not move: no hop, the "z" or drop halfway, one heart halfway up (the pupils rest at LOOK). */
export const REST = { lift: 0, drift: 0.5, beat: HEART_RISE / 2 } as const;

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

/** An eye [eyeW] wide (mascot/layout/eyes.ts), [lid] open, turned with a gaze of [look] past its pupil's reach (a glance). */
export function eyeStyle(lid: number, look: number, eyeW: number) {
  'worklet';
  return { transform: [{ translateX: (look - reached(look)) * eyeW * GAZE_W }, { scaleY: lid }] };
}

/** The pupils looking [look] of the way to a side (-1 to 1, held to their reach) in an eye [eyeW] wide. */
export function pupilStyle(look: number, eyeW: number) {
  'worklet';
  return { transform: [{ translateX: reached(look) * eyeW * GAZE_W }] };
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

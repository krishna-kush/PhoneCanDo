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

/** Asleep's "z": one float up, and the wait before the next. */
export const Z_FLOAT_MS = 1800;
export const Z_WAIT_MS = 500;
/** How far along its float the "z" is first seen in full: a nap handed over to starts it there, never from unseen. */
export const Z_SHOWN = 0.2;

/** One move of a reaction's lids: to `lid` over `ms`, then held `hold`. */
export type LidStep = { readonly lid: number; readonly ms: number; readonly hold: number };

type ReactionSpec = {
  readonly from: 'awake' | 'asleep';
  readonly to: 'awake' | 'asleep';
  /** How long it stays as it was before its lids move. */
  readonly sleepMs: number;
  readonly steps: readonly LidStep[];
  /** How far the figure moves, in face sizes, over the first step and back over the last: down a wince or a nod, up a jump or a stretch. */
  readonly lean: number;
  /** Waking: when the "z" starts to go and the pupils to come. Dozing off, it is as the lids meet. */
  readonly napAt?: number;
  /** How long that hand-over takes. */
  readonly napMs: number;
};

/**
 * A one-off move between awake and asleep, in one go, after which the
 * face carries on as its `to` mood (AgentFace's `reaction`).
 * The theme sweep's A-01: glare wakes as the lights come on (asleep, "z"
 * and all, then the "z" goes and the pupils come as it squints against
 * the light, holds, and blinks its eyes open); startle dozes off as they
 * go out (its eyes go wide, hold, and slowly close).
 * Privacy's guard: doze falls asleep at the desk (the lids droop half
 * shut, one heavy blink, drag back up, then drift shut, its head nodding);
 * wake comes to slowly (the "z" drifts off and fades, the lids open half
 * way with a stretch, blink, then open).
 * Dozing off, the "z" starts as the lids meet, already in view (Z_SHOWN).
 */
export const REACTION = {
  glare: {
    from: 'asleep',
    to: 'awake',
    sleepMs: 250,
    steps: [
      { lid: 0.22, ms: 70, hold: 200 },
      { lid: LID.awake, ms: 130, hold: 0 },
    ],
    lean: 0.06,
    napAt: 250,
    napMs: 70,
  },
  startle: {
    from: 'awake',
    to: 'asleep',
    sleepMs: 0,
    steps: [
      { lid: 1.4, ms: 70, hold: 250 },
      { lid: LID.asleep, ms: 350, hold: 0 },
    ],
    lean: -0.14,
    napMs: 0,
  },
  doze: {
    from: 'awake',
    to: 'asleep',
    sleepMs: 0,
    steps: [
      { lid: 0.5, ms: 300, hold: 200 },
      { lid: LID.asleep, ms: 110, hold: 0 },
      { lid: 0.4, ms: 170, hold: 80 },
      { lid: LID.asleep, ms: 450, hold: 0 },
    ],
    lean: 0.05,
    napMs: 150,
  },
  wake: {
    from: 'asleep',
    to: 'awake',
    sleepMs: 300,
    steps: [
      { lid: 0.5, ms: 350, hold: 150 },
      { lid: LID.asleep, ms: 100, hold: 0 },
      { lid: LID.awake, ms: 300, hold: 0 },
    ],
    lean: -0.05,
    napAt: 150,
    napMs: 300,
  },
} as const satisfies Record<string, ReactionSpec>;

export type Reaction = keyof typeof REACTION;

const spec = (r: Reaction): ReactionSpec => REACTION[r];

/** When a reaction's step [i] starts to move, from its start. */
export function stepAtMs(r: Reaction, i: number): number {
  const s = spec(r);
  return s.steps.slice(0, i).reduce((at, step) => at + step.ms + step.hold, s.sleepMs);
}

/** When its lids are done moving. */
export function lidsDoneMs(r: Reaction): number {
  return stepAtMs(r, spec(r).steps.length);
}

/** When the "z" starts to go and the pupils to come (waking), or the other way round (dozing off: as the lids meet). */
export function napAtMs(r: Reaction): number {
  const s = spec(r);
  return s.napAt ?? lidsDoneMs(r);
}

/** A reaction's whole length, start to end: from then on it is its `to` mood. */
export function reactionMs(r: Reaction): number {
  return Math.max(lidsDoneMs(r), napAtMs(r) + spec(r).napMs);
}

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

/** A reaction's pupils, there while [nap] is 0 (awake) and gone at 1 (asleep). */
export function napPupilStyle(look: number, eyeW: number, nap: number) {
  'worklet';
  return { ...pupilStyle(look, eyeW), opacity: 1 - nap };
}

/** A reaction's "z", there only while [nap] is 1 (asleep). */
export function napZStyle(drift: number, mark: number, nap: number) {
  'worklet';
  const z = zStyle(drift, mark);
  return { ...z, opacity: z.opacity * nap };
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

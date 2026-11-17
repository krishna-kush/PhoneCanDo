// How a face goes from one mood to another, as AgentFace plays it on the UI
// thread: its lids' steps from wherever they are, a lean with them, and the
// hand-over, when the marks of the mood it leaves fade out as the new
// mood's fade in (parts.ts). Any change of mood picks one (changeOf); a few
// are named (REACTION) for a face that plays one as it appears.
// Pure (zero RN imports).
import type { Mood } from '../mood';
import { GLANCE, LID, LOOK } from '../motion.ts';

/** One move of the lids: to `lid` over `ms`, then held `hold`. */
export type LidStep = { readonly lid: number; readonly ms: number; readonly hold: number };

/** One move of the pupils: to a gaze of `gaze` (-1 to 1) over `ms`, then held `hold`. */
export type LookStep = { readonly gaze: number; readonly ms: number; readonly hold: number };

export type Change = {
  /** How long it stays as it was before its lids move. */
  readonly sleepMs: number;
  /** Its lids' moves; the last ends on the new mood's own lid. */
  readonly steps: readonly LidStep[];
  /** How far the figure moves, in face sizes, over the first step and back over the last: down a wince or a nod, up a jump or a stretch. */
  readonly lean: number;
  /** When the marks hand over (waking: the "z" goes and the pupils come); as its lids are done when left out. */
  readonly handOverAt?: number;
  /** How long that hand-over takes. */
  readonly handOverMs: number;
  /** Where the pupils look once they are in, before the new mood's own looking starts (a jolt: who woke it?). */
  readonly look?: readonly LookStep[];
};

/**
 * A change between awake and asleep with a name, played in one go.
 * Glare, the theme sweep's lights coming on: asleep, "z" and all, then the
 * "z" goes and the pupils come as it squints against the light, holds,
 * and blinks its eyes open.
 * Any face dozing off or coming to (and the sweep's lights going out):
 * doze falls asleep at the desk (the lids droop half shut, one heavy
 * blink, drag back up, then drift shut, its head nodding); wake comes to
 * slowly (the "z" drifts off and fades, the lids open half way with a
 * stretch, blink, then open).
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
    handOverAt: 250,
    handOverMs: 70,
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
    handOverMs: 150,
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
    handOverAt: 150,
    handOverMs: 300,
  },
} as const satisfies Record<string, Change & { readonly from: Mood; readonly to: Mood }>;

export type Reaction = keyof typeof REACTION;

/** Looking around for who woke or tapped it: left, then right, past the pupils' reach so the eyes turn, then back to [rest]. */
export function lookAround(rest: number): readonly LookStep[] {
  return [
    { gaze: -GLANCE.to, ms: 150, hold: 280 },
    { gaze: GLANCE.to, ms: 260, hold: 280 },
    { gaze: rest, ms: 180, hold: 0 },
  ];
}

/**
 * A tap waking it: its eyes pop wide as it hops (the hop is its lift), then
 * settle open, the "z" gone at once, and it looks around to see who woke
 * it before it settles.
 */
export const JOLT: Change = {
  sleepMs: 0,
  steps: [
    { lid: 1.25, ms: 80, hold: 140 },
    { lid: LID.awake, ms: 140, hold: 0 },
  ],
  lean: 0,
  handOverAt: 0,
  handOverMs: 80,
  look: lookAround(LOOK.awake),
};

/** Every other change: the lids ease to the new mood's as its marks cross-fade. */
export const BLEND_MS = 220;

function blend(to: Mood): Change {
  return { sleepMs: 0, steps: [{ lid: LID[to], ms: BLEND_MS, hold: 0 }], lean: 0, handOverAt: 0, handOverMs: BLEND_MS };
}

// [c] with its last step ending on [lid] (waking into a frown opens only so far).
function endingOn(c: Change, lid: number): Change {
  const last = c.steps.length - 1;
  return { ...c, steps: c.steps.map((step, i) => (i === last ? { ...step, lid } : step)) };
}

/**
 * The change a face plays going from [from] to [to]: out of sleep it comes
 * to (a tap, [booped], jolts it awake instead), into sleep it dozes off,
 * and anything else blends (happy's smile included, its eyes squinting shut
 * into it or open out of it).
 */
export function changeOf(from: Mood, to: Mood, booped: boolean): Change {
  if (from === to || from === 'happy' || to === 'happy') return blend(to);
  if (from === 'asleep') return endingOn(booped ? JOLT : REACTION.wake, LID[to]);
  if (to === 'asleep') return REACTION.doze;
  return blend(to);
}

// How pages move. Pure maths for the UI thread (every function is a
// worklet; zero RN imports), after Android 14+: a page opens sliding in
// from the right while it fades in, the one below drifts left and fades out
// fast; Back shrinks the page under the thumb (predictive back), then it
// slides off and the page below settles into place.
// Specs: developer.android.com/design/ui/mobile/guides/patterns/predictive-back

/** Which part a layer plays in the transition on screen. */
export type LayerRole = 'top' | 'enter' | 'exit' | 'leave' | 'reveal' | 'hidden';

export const PUSH_MS = 380;
/** Back released past the threshold: the page leaves from where the thumb left it. */
export const COMMIT_MS = 260;
/** Back without a gesture (the back key, Android 13 and older): shrink and leave in one go. */
export const PRESS_MS = 320;
export const CANCEL_MS = 200;

/** Share of the width a page travels on the way in. */
const SLIDE = 0.25;
/** Smallest a page gets under the thumb. */
const MIN_SCALE = 0.9;
/** The page below starts this far left and comes in as the top one goes. */
const PARALLAX = 0.08;
const SCRIM = 0.45;

function clamp01(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Fast at first, then slow: the gesture shows from its first pixels (STANDARD_DECELERATE's shape). */
export function decelerate(p: number): number {
  'worklet';
  const q = 1 - clamp01(p);
  return 1 - q * q * q;
}

export type Motion = {
  /** Opening: 0 → 1 (eased). */
  push: number;
  /** Back gesture progress, raw 0 → 1. */
  pull: number;
  /** Back committed: 0 → 1 (eased). */
  commit: number;
  /** The thumb's side while the gesture lasts: +1 a swipe from the left edge, -1 from the right. */
  edge: number;
};

// Transform and opacity only: Android applies them without laying the page
// out again (with Reanimated's ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS, set in
// app/package.json), and nothing here clips a web view.
export type LayerStyle = {
  opacity: number;
  transform: ({ translateX: number } | { scale: number })[];
};

const IDENTITY: LayerStyle = { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] };
// One object for every hidden layer: an unchanged style sends no update.
const HIDDEN: LayerStyle = { opacity: 0, transform: [{ translateX: 0 }, { scale: 1 }] };

export function layerStyle(role: LayerRole, m: Motion, width: number): LayerStyle {
  'worklet';
  switch (role) {
    case 'top':
      return IDENTITY;
    case 'hidden':
      return HIDDEN;
    case 'enter':
      return {
        opacity: clamp01(m.push / 0.5),
        transform: [{ translateX: width * SLIDE * (1 - m.push) }, { scale: 1 }],
      };
    case 'exit':
      return {
        opacity: 1 - clamp01(m.push / 0.35),
        transform: [{ translateX: -width * SLIDE * m.push }, { scale: 1 }],
      };
    case 'leave': {
      const g = decelerate(m.pull);
      // Under the thumb, or quickly on a back without a gesture.
      const shrink = Math.max(g, clamp01(m.commit * 2));
      // A little toward the thumb while it pulls; once committed always off
      // to the right, the way back from where pages come in.
      const drift = m.edge * (width / 20 - 8) * g;
      return {
        opacity: 1 - clamp01((m.commit - 0.25) / 0.75),
        transform: [{ translateX: drift + width * 0.5 * m.commit }, { scale: 1 - (1 - MIN_SCALE) * shrink }],
      };
    }
    case 'reveal': {
      const g = decelerate(m.pull);
      const away = (1 - m.commit) * (1 - 0.4 * g);
      return {
        opacity: 1,
        transform: [{ translateX: -width * PARALLAX * away }, { scale: 1 }],
      };
    }
  }
}

export type StackState = {
  /** 0 at rest, 1 push, 2 pop. */
  kind: number;
  moving: string;
  under: string;
  top: string;
  below: string;
  previewing: boolean;
};

/**
 * A layer's part, by its key, from the stack's state on the UI thread: on a
 * push the moving layer enters over the one that exits; on a pop it leaves
 * over the one revealed; at rest the top layer is in front (leaving under
 * the thumb while a back gesture previews it, with the one below revealed)
 * and the rest are hidden.
 */
export function roleOf(key: string, s: StackState): LayerRole {
  'worklet';
  if (s.kind === 1) return key === s.moving ? 'enter' : key === s.under ? 'exit' : 'hidden';
  if (s.kind === 2) return key === s.moving ? 'leave' : key === s.under ? 'reveal' : 'hidden';
  if (key === s.top) return s.previewing ? 'leave' : 'top';
  if (s.previewing && key === s.below) return 'reveal';
  return 'hidden';
}

/** The dim over the page below while the top one goes. */
export function scrimOpacity(role: LayerRole, m: Motion): number {
  'worklet';
  if (role === 'reveal') return SCRIM * (1 - m.commit) * (1 - 0.3 * decelerate(m.pull));
  if (role === 'exit') return SCRIM * m.push;
  return 0;
}

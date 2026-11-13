// A unit's eyes: where they sit on its front block, face on (two) or side
// on (one, at the edge it leads with), how far its lids are down for the
// expression, and where its pupils look.

import type { Box, Eye } from './types.ts';

/** How it looks out: open, wide, half shut, shut, or squinting in a smile. */
export type Eyes = 'dot' | 'wide' | 'sleepy' | 'shut' | 'happy';

/** The eye's proportions, in S: its size, the gap between two, how far down the block, and how much taller a wide eye is. */
export const EYE = { w: 0.25, h: 0.29, gap: 0.08, top: 0.29, wide: 1.24 };

/** How much of the eye shows for each expression. */
const OPEN: Record<Eyes, number> = { dot: 1, wide: 1, sleepy: 0.4, shut: 0.15, happy: 0.34 };

export type EyeStance = {
  S: number;
  sx: number;
  sy: number;
  eyes: Eyes;
  /** Where the pupils point, -1 to 1 each way. */
  gaze: readonly [number, number];
  /** Side on, which way it faces: -1 left, 1 right; 0 face on. */
  toward: -1 | 0 | 1;
};

export function layEyes(front: Box, st: EyeStance): Eye[] {
  const ew = st.S * EYE.w * st.sx;
  const full = st.S * EYE.h * st.sy * (st.eyes === 'wide' ? EYE.wide : 1);
  const gap = st.S * EYE.gap * st.sx;
  const ey = front.y + st.S * EYE.top * st.sy;
  const eh = full * OPEN[st.eyes];
  // Shut and sleepy lids close from the top; a happy squint keeps the top.
  const top = st.eyes === 'happy' ? ey : ey + full - eh;
  const xs = st.toward
    ? [st.toward > 0 ? front.x + front.w - ew * 1.3 : front.x + ew * 0.3]
    : [front.x + (front.w - (ew * 2 + gap)) / 2, front.x + (front.w + gap) / 2];
  const gx = st.toward ? st.toward * 0.8 : st.gaze[0];
  return xs.map((x) => {
    const pupil =
      eh > full * 0.5
        ? {
            x: x + ew * 0.25 + gx * ew * 0.22,
            y: top + eh * 0.3 + st.gaze[1] * eh * 0.16,
            w: ew * 0.5,
            h: full * (st.eyes === 'wide' ? 0.32 : 0.43),
          }
        : null;
    return { open: { x, y: ey, w: ew, h: full }, lid: { x, y: top, w: ew, h: eh }, pupil };
  });
}

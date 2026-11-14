// Lights: everyone asleep in the dark. A-01 wakes, looks about, gets up
// and jumps for the lamp cord over its bed; the others wake as the lamps
// come on.

import { MOMENTS } from '../../script/moments.ts';
import { CORD } from '../../world/plan.ts';
import { A01, CAST } from '../cast.ts';
import type { Script } from '../script.ts';

/** How long A-01's jump to the cord takes; it pulls at the top. */
export const JUMP = 0.8;

export function lights(s: Script) {
  const m = MOMENTS.lights;
  CAST.forEach((member, i) => {
    const wakes = i === 0 ? m.wake : m.yawns[i - 1];
    s.act(member, { kind: 'sleep', from: -Infinity, to: wakes });
    // The others stretch as they wake.
    if (i > 0) s.act(member, { kind: 'tug', at: wakes + 0.15 });
  });

  const { x, y } = A01.bunk;
  s.act(A01, { kind: 'gaze', from: m.wake + 0.2, to: m.wake + 0.6, x: -1, y: 0 });
  s.act(A01, { kind: 'gaze', from: m.wake + 0.6, to: m.hop - 0.25, x: 1, y: 0 });
  // Up on its feet with a hop, a look at the cord, then a jump for it.
  s.go(A01, { at: m.hop, x, y, len: 0.6, how: 'hop' });
  s.act(A01, { kind: 'gaze', from: m.hop + 0.5, to: m.lamps[0] + 0.3, x: 0, y: -1 });
  s.go(A01, { at: m.lamps[0] - JUMP / 2, x, y, len: JUMP, how: 'hop', height: CORD.jump });
  // It watches the lamps come on down the hall, then what is going on down on the strip.
  s.act(A01, { kind: 'gaze', from: m.lamps[1], to: m.lamps[2], x: 1, y: -0.6 });
  s.act(A01, { kind: 'gaze', from: m.lamps[2], to: m.lamps[3] + 0.5, x: -1, y: -0.6 });
  s.act(A01, { kind: 'gaze', from: m.strike, to: m.write + 1.2, x: 0.3, y: 1 });
}

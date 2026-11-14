// Crew: A-01 shrugs at the narrator's line, and the others pop out one
// after another. Then four of them set off up the ladder to the workshop.

import { MOMENTS } from '../../script/moments.ts';
import { groundOf, SHAFT, WORKSHOP } from '../../world/plan.ts';
import { A01, CAST, memberIn } from '../cast.ts';
import type { Script } from '../script.ts';

/** Who climbs to the workshop, the digger first: it throws the breaker, the rest take a bench each. */
export const WORKERS = ['digger', 'coder', 'tester', 'checker'] as const;

export function crew(s: Script) {
  const m = MOMENTS.crew;
  s.act(A01, { kind: 'gaze', from: m.line + 0.3, to: m.pops[0], x: 0, y: 0, eyes: 'wide' });
  s.act(A01, { kind: 'shrug', at: m.shrug });

  CAST.slice(1).forEach((member, i) => {
    s.go(member, { at: m.pops[i], x: member.bunk.x, y: member.bunk.y, len: 0.5, how: 'hop' });
  });
  // A-01 watches them pop out, left then right, then looks down at the strip again.
  const half = Math.floor(m.pops.length / 2);
  s.act(A01, { kind: 'gaze', from: m.pops[0], to: m.pops[half], x: -1, y: -0.4 });
  s.act(A01, { kind: 'gaze', from: m.pops[half], to: m.strike, x: 1, y: -0.4 });
  s.act(A01, { kind: 'gaze', from: m.strike, to: m.write + 1.2, x: 0.3, y: 1 });

  const spots = [WORKSHOP.breaker, ...WORKSHOP.bench];
  WORKERS.forEach((design, k) => {
    const member = memberIn(design);
    let t = m.climb + k * 0.4;
    if (member.bunk.upper) {
      s.go(member, { at: t, x: member.bunk.x, y: groundOf('bunks'), len: 0.4, how: 'hop' });
      t += 0.4;
    }
    t = s.trip(member, t, SHAFT, groundOf('bunks'), 'walk', 70);
    t = s.trip(member, t, SHAFT, groundOf('workshop'), 'climb', 45);
    s.trip(member, t, spots[k], groundOf('workshop'), 'walk', 60);
  });
}

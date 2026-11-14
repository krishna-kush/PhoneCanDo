// Dawn: the night watch rings the bell, everyone looks up, then runs for
// the ladder, slides down it and gets back into bed. A-01 goes last and
// jumps for the cord. The one who lost its hat on the glass sneaks back for it.

import { lookOf } from '../../../../brand/units/body.ts';
import { MOMENTS } from '../../script/moments.ts';
import { CORD, GLASS, groundOf, SHAFT } from '../../world/plan.ts';
import { A01, CAST, memberIn, type Member } from '../cast.ts';
import type { Script } from '../script.ts';
import { JUMP } from './lights.ts';

const WALK = 95;
const SLIDE = 150;

/** When the hat comes off its owner: just after it starts to run. */
export const HAT_OFF = MOMENTS.dawn.scramble[0] + 0.5;

export function dawn(s: Script) {
  const m = MOMENTS.dawn;
  const bunks = groundOf('bunks');
  const watch = memberIn('watch');
  const hatless = memberIn('top-hat');
  for (const ring of m.bell) s.act(watch, { kind: 'tug', at: ring });
  for (const member of CAST) if (member !== watch) s.act(member, { kind: 'gaze', from: m.bell[0], to: m.scramble[0], x: 0.7, y: -1, eyes: 'wide' });

  /** Home by the ladder; when it is at the foot of its bed. */
  const home = (member: Member, from: number, x: number): number => {
    const here = s.whereIs(member);
    let t = s.trip(member, from, SHAFT, here.y, 'walk', WALK);
    t = s.trip(member, t, SHAFT, bunks, 'climb', SLIDE);
    return s.trip(member, t, x, bunks, 'walk', WALK);
  };

  // Top floor first, a little apart, so they queue at the ladder rather than run through one another.
  const runners = CAST.filter((member) => member !== A01).sort((a, b) => s.whereIs(a).y - s.whereIs(b).y);
  runners.forEach((member, k) => {
    let t = home(member, m.scramble[0] + k * 0.07, member.bunk.x);
    if (member.bunk.upper) {
      s.go(member, { at: t, x: member.bunk.x, y: member.bunk.y, len: 0.4, how: 'hop' });
      t += 0.4;
    }
    s.act(member, { kind: 'sleep', from: t + 0.2, to: member === hatless ? m.hat[0] : Infinity });
  });

  // A-01 sees everyone off the glass, then follows; it jumps for the cord and is asleep as it lands.
  s.act(A01, { kind: 'gaze', from: m.scramble[0], to: m.out[0] - 0.4, x: -1, y: 0 });
  home(A01, m.out[0] - 0.3, A01.bunk.x);
  s.go(A01, { at: m.out[3] - JUMP / 2, x: A01.bunk.x, y: A01.bunk.y, len: JUMP, how: 'hop', height: CORD.jump });
  s.act(A01, { kind: 'sleep', from: m.out[3] + JUMP / 2 + 0.2, to: Infinity });

  // The hat: off as its owner runs, fetched once the lights are out.
  s.act(hatless, { kind: 'wear', from: HAT_OFF, to: m.grab, look: lookOf('plain') });
  s.go(hatless, { at: m.hat[0], x: SHAFT, y: groundOf('glass') });
  s.go(hatless, { at: m.hat[0], x: GLASS.hat - 8, y: groundOf('glass'), len: m.grab - 0.2 - m.hat[0], how: 'walk' });
  s.act(hatless, { kind: 'gaze', from: m.hat[0], to: m.grab - 0.4, x: 1, y: 0.2, eyes: 'wide' });
  s.act(hatless, { kind: 'tug', at: m.grab });
  s.go(hatless, { at: m.grab + 0.25, x: SHAFT, y: groundOf('glass'), len: m.hat[1] - m.grab - 0.25, how: 'walk' });
  s.act(hatless, { kind: 'gone', from: m.hat[1], to: Infinity });
}

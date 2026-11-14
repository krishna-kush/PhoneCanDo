// Song: the narrator says they make no sound, and nobody moves. The one in
// headphones taps the needle, drops it, and everybody on every floor
// dances, each in its own way.

import { MOMENTS } from '../../script/moments.ts';
import { ROOF } from '../../world/plan.ts';
import { CAST, memberIn } from '../cast.ts';
import type { Script } from '../script.ts';

export function song(s: Script) {
  const m = MOMENTS.song;
  // The night watch takes its place on the roof while nobody is looking. One never left its bed, and dances there.
  s.go(memberIn('watch'), { at: m.line - 1, x: 56, y: ROOF });

  CAST.forEach((member, i) => {
    s.act(member, { kind: 'gaze', from: m.line + 0.25, to: m.drop, x: 0, y: 0, eyes: 'wide' });
    s.act(member, { kind: 'dance', from: m.drop, to: MOMENTS.dawn.bell[0], style: i });
  });
  for (const tap of m.taps) s.act(memberIn('dj'), { kind: 'tug', at: tap });
}

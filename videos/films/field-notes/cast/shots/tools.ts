// Tools: the digger throws the breaker and watches the terminal wake; the
// three at the benches get to work.

import { MOMENTS } from '../../script/moments.ts';
import { memberIn } from '../cast.ts';
import type { Script } from '../script.ts';
import { WORKERS } from './crew.ts';

export function tools(s: Script) {
  const m = MOMENTS.tools;
  const digger = memberIn('digger');
  s.act(digger, { kind: 'tug', at: m.breaker });
  s.act(digger, { kind: 'gaze', from: m.breaker + 0.4, to: MOMENTS.song.line, x: -1, y: -0.3 });
  // Working: a quick bob, until the narrator's hush.
  for (const design of WORKERS.slice(1)) s.act(memberIn(design), { kind: 'dance', from: m.typing[m.typing.length - 1], to: MOMENTS.song.line, style: 3 });
}

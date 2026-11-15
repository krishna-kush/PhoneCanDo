// Little's story as one clock in seconds. Each floor is a stretch of it: its
// beats, then the walk to the hatch and the drop to the next floor. The
// scroll never sets the clock, only where it is headed: always the end of
// a beat, a rest, so Little is never left hanging mid-move when the page stops.
// A chapter's beats run over the front of its part only (STAGE), so Little
// has dropped through its hatch while its deck is still seen from above.

import { EYE, PITCH } from '../../world/building';
import type { Floor, Story } from '../../world/frame';
import { EXIT } from './exit';
import { at } from './pose';

export type Stretch = { start: number; length: number; leaveAt: number | null; story: Story };
export type Timeline = { stretches: Stretch[]; total: number };

// A floor with no chapter of its own: Little lands and goes on down.
const PASS: Story = { rests: [], leave: 0.5, pose: (_, room) => at(room.hatch), narrate: [] };

/** How far over a floor's deck the camera still is at its chapter's q of 1, world units; every leave comes before that. */
const CLEAR = 100;
/**
 * How much of its part a chapter's q (its rests and leave) runs over. The
 * camera comes level with a floor's deck at q = 0.5 + EYE / PITCH (cameraY),
 * and past that the deck is seen from below; a chapter's q of 1 lands CLEAR
 * short of that, so its drop is done before the deck goes flat.
 */
const STAGE = 0.5 + (EYE - CLEAR) / PITCH;

export function makeTimeline(floors: Floor[]): Timeline {
  let start = 0;
  const stretches = floors.map((floor, i) => {
    const story = floor.scene.story ?? PASS;
    const rest = story.rests.length ? story.rests[story.rests.length - 1][1] : 0;
    const leaveAt = i < floors.length - 1 ? rest : null;
    const length = leaveAt === null ? rest : rest + EXIT;
    const stretch = { start, length, leaveAt, story };
    start += length;
    return stretch;
  });
  return { stretches, total: start };
}

/** Where the clock is headed for a scroll position, as a floor number (track.ts). */
export function goal(tl: Timeline, floor: number): number {
  const n = tl.stretches.length;
  if (!n) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.floor(floor)));
  const q = (floor - i) / STAGE;
  const st = tl.stretches[i];
  let sec = 0;
  for (const [from, rest] of st.story.rests) if (q >= from) sec = rest;
  if (st.leaveAt !== null && q >= st.story.leave) sec = st.length;
  return st.start + sec;
}

/** The floor Little is on at [clock], and how many seconds into it. */
export function find(tl: Timeline, clock: number): { i: number; sec: number } {
  const last = tl.stretches.length - 1;
  for (let i = 0; i <= last; i++) {
    const st = tl.stretches[i];
    if (clock < st.start + st.length || i === last) return { i, sec: Math.min(st.length, Math.max(0, clock - st.start)) };
  }
  return { i: 0, sec: 0 };
}

/** Seconds into floor i's stretch: 0 until Little lands there, its length once it has gone. */
export function secOn(tl: Timeline, i: number, clock: number): number {
  const st = tl.stretches[i];
  return st ? Math.min(st.length, Math.max(0, clock - st.start)) : 0;
}

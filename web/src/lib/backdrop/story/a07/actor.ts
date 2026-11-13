// Where Little is this frame, from the story clock: the floor it is on, how
// far into that floor's chapter, its pose (the chapter's, or the walk to the
// hatch and the drop once it leaves), and the kit it has on by then.

import type { Actor, Frame } from '../../world/frame';
import { makeRoom } from '../room';
import { leaving } from './exit';
import { NO_KIT } from './look';
import { find } from './timeline';

export function placeA07(f: Frame): Actor | null {
  const { stretches } = f.timeline;
  if (!stretches.length) return null;
  const { i, sec } = find(f.timeline, f.clock);
  const st = stretches[i];
  const room = makeRoom(f, i, 1);
  let kit = NO_KIT;
  for (let j = 0; j < i; j++) kit = { ...kit, ...f.floors[j].scene.story?.after };
  const pose =
    st.leaveAt !== null && sec > st.leaveAt
      ? leaving(st.story.pose(st.leaveAt, room), room.hatch, sec - st.leaveAt)
      : st.story.pose(sec, room);
  return { i, sec, pose, kit: { ...kit, ...pose.kit } };
}

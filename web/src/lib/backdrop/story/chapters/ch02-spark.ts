// CH. 02, beside the agents and models: a spark. To think, Little sends its
// question up a thread to a Drifter, one of the cloud folk, far back and
// high over the floor, and waits while it thinks; the answer takes the long
// road down. Then a spark lights on the floor beside it, hops over and
// climbs onto its head: a mind of its own, which stays. The thread and the
// cloud fade; they aren't needed now.

import { easeInOut, easeOut, jump, mix, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { floatDrifter } from '../characters/drifter';
import { drawSpark } from '../characters/spark';
import { A07 } from '../a07/look';
import { at, play, walk, type Spot, type Step } from '../a07/pose';
import { drawNote } from '../props';
import type { Room } from '../room';

const SENT = 1.2;
const ASKED = 2.8;
const ANSWERED = 5.2;
const LIT = 6.0;
const NEAR = 7.0;
const MOUNTED = 7.8;
const KEPT = 8.6;

/** The Drifter the question goes up to: how far back and how high it floats (over the story's words), how far out across the margin, and how wide. */
const HIGH = { z: 1150, up: 860, out: 0.62, w: 150 };

const spots = (fit: (width: number) => number) => {
  const o = fit(140);
  return { o, stand: { out: o + 40, z: 170 } as Spot, glow: { out: o + 120, z: 150 } as Spot };
};

function steps(room: Room): Step[] {
  const { stand } = spots(room.fit);
  const up = [-room.side * 0.6, -1] as const;
  return [
    [0, SENT, (k) => walk(room.hatch, stand, k)],
    [SENT, ASKED, () => at(stand, { gaze: up, eyes: 'wide' })],
    // Waiting for the answer, drooping.
    [ASKED, ANSWERED, (k) => at(stand, { gaze: k < 0.8 ? up : [0, -0.4], eyes: k < 0.4 ? 'dot' : 'sleepy', sy: 1 - 0.06 * span(k, 0.3, 0.8) })],
    [ANSWERED, NEAR, (k) => at(stand, { gaze: [room.side, 0.4], eyes: k > 0.3 ? 'wide' : 'sleepy' })],
    [NEAR, MOUNTED, () => at(stand, { gaze: [0, -1], eyes: 'wide' })],
    [MOUNTED, KEPT, (k) => at(stand, { eyes: 'happy', sy: 1 + 0.06 * Math.sin(k * Math.PI), kit: { spark: true } })],
  ];
}

export const story: Story = {
  rests: [
    [0.12, ASKED],
    [0.35, ANSWERED],
    [0.58, KEPT],
  ],
  leave: 0.85,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, ANSWERED],
  after: { spark: true },
  // From where it first lit, a line runs on down to the tunnel (story/gifts/).
  gives: { gift: 'spark', at: MOUNTED, from: (room) => spots(room.fit).glow },
};

/** The Drifter's middle, world x and y. */
const cloudAt = (room: Room) => ({ x: room.x(room.margin * HIGH.out, HIGH.z), y: room.y - HIGH.up });

/** The Drifter, looking down at Little, thinking a while once the question is up; gone once the Spark has stayed. */
function drawCloud(room: Room) {
  const { sec } = room;
  const shown = 1 - span(sec, MOUNTED, KEPT);
  if (shown <= 0) return;
  const thinking = span(sec, ASKED - 0.2, ASKED) * (1 - span(sec, ASKED + 0.6, ASKED + 0.9));
  room.pen.faded(shown, () =>
    floatDrifter(room, 'drifter', cloudAt(room).x, HIGH.up, HIGH.z, HIGH.w, { gaze: -room.side * 0.6, down: 1, thinking }),
  );
}

/**
 * The thread from Little's head up to the Drifter's underside, with the
 * question going up it and the answer coming down, both slowly.
 */
function drawThread(room: Room) {
  const { pen, sec } = room;
  const { pal } = pen;
  const threadA = span(sec, 0.6, SENT) * (1 - span(sec, MOUNTED, KEPT));
  if (threadA <= 0) return;
  const { stand } = spots(room.fit);
  const head = [room.x(stand.out, stand.z), room.y - A07.size * 1.25, stand.z] as const;
  const cloud = cloudAt(room);
  const far = [cloud.x, cloud.y + HIGH.w * 0.22, HIGH.z] as const;
  pen.faded(threadA * 0.7, () => pen.line(head, far, pal.ink, 1, [4, 4]));
  const along = (k: number) => [mix(head[0], far[0], k), mix(head[1], far[1], k), mix(head[2], far[2], k)] as const;
  const upK = easeOut(span(sec, SENT, ASKED));
  if (upK > 0 && upK < 1) {
    const p = along(upK);
    pen.faded(1 - span(upK, 0.7, 1), () => drawNote(pen, p[0], p[1], p[2], 12, upK * 4));
  }
  const downK = span(sec, ASKED + 0.8, ANSWERED - 0.2);
  if (downK > 0 && downK < 1) {
    const p = along(1 - downK);
    pen.faded(span(downK, 0, 0.3), () => drawNote(pen, p[0], p[1], p[2], 12, -downK * 4));
  }
}

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { stand, glow } = spots(room.fit);
  drawCloud(room);
  room.a07();
  drawThread(room);

  // The spark: a glow on the floor, then two hops over, then up onto its head.
  if (sec < LIT - 0.8 || sec >= MOUNTED) return;
  const shine = span(sec, LIT - 0.8, LIT);
  const hops = span(sec, LIT, NEAR);
  const climb = span(sec, NEAR, MOUNTED);
  const beside: Spot = { out: stand.out + 24, z: stand.z - 6 };
  let out = glow.out;
  let z = glow.z;
  let up = 0;
  if (hops > 0) {
    const n = Math.min(1, Math.floor(hops * 2));
    const q = hops * 2 - n;
    const from = n === 0 ? glow : { out: (glow.out + beside.out) / 2, z: (glow.z + beside.z) / 2 };
    const to = n === 0 ? { out: (glow.out + beside.out) / 2, z: (glow.z + beside.z) / 2 } : beside;
    out = mix(from.out, to.out, easeInOut(q));
    z = mix(from.z, to.z, easeInOut(q));
    up = jump(q, 14).lift;
  }
  if (climb > 0) {
    out = mix(beside.out, stand.out, easeInOut(climb));
    z = mix(beside.z, stand.z, climb);
    up = A07.size * 1.12 * easeOut(climb) + jump(climb, 20).lift;
  }
  // Its first light rings out across the floor.
  if (shine > 0 && sec < LIT + 0.6) {
    const k = span(sec, LIT - 0.8, LIT + 0.6);
    pen.faded(1 - k, () => pen.ring(room.x(glow.out, glow.z), room.y, glow.z, 8 + k * 60, pal.accent, 1.5));
  }
  pen.faded(shine, () => drawSpark(pen, room.x(out, z), room.y - up, z, t, [-room.side, -0.2]));
}

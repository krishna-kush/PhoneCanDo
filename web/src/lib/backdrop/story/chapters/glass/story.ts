// CH. 00, the glass, beside the hero. A-07 hangs under a cloud on a cord
// into its head: the cloud relay. It tugs until the cord snaps, drops onto
// the phone's glass (its landing a tap), watches the cloud go, and hops over
// the app tiles: on the phone itself now, no relay.

import { drawCloud } from '../../../paint/cloud';
import { arch, easeIn, mix, phase, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { at, hop, play, type Spot, type Step } from '../../a07/pose';
import type { Room } from '../../room';

const COLS = 3;
const TILE = 30;
const STEP = 40;
const ROW_Z = [150, 150 + STEP];
const TILE_H = 4;
const WIDTH = COLS * STEP;

// It hangs over tile 4 (back row, middle), under the cloud.
const HANG = 4;
const HANG_UP = 170;
const CLOUD_UP = 300;
const CLOUD_W = 112;
// The cord gives at this second; the cloud is gone by the next.
const SNAP = 0.9;
const LANDED = 1.5;
const GONE = 2.4;
// The tiles it hops over once it is down.
const ROUTE = [4, 2, 0, 1];
const HOP = 0.75;
const HOPPED = GONE + HOP * (ROUTE.length - 1);

const tileAt = (o: number, k: number): Spot => ({
  out: o + (k % COLS) * STEP + TILE / 2,
  z: ROW_Z[Math.floor(k / COLS)] + TILE / 2,
});

function steps(room: Room): Step[] {
  const o = room.fit(WIDTH);
  const tile = (k: number) => tileAt(o, k);
  const hang = tile(HANG);
  const swing = Math.sin(room.t * 1.7) * 5;
  return [
    // Hanging, swinging a little; then tugging, harder and harder.
    [
      0,
      SNAP,
      (k) =>
        at(
          { out: hang.out + swing * (1 - k) + Math.sin(room.t * 40) * 2.4 * k, z: hang.z },
          { up: HANG_UP, sx: 1 + 0.07 * k * Math.abs(Math.sin(room.t * 20)), eyes: k > 0.4 ? 'wide' : 'dot', gaze: [0, k > 0.4 ? -1 : 1] },
        ),
    ],
    // The cord snaps: down onto the glass.
    [SNAP, LANDED, (k) => at(hang, { up: TILE_H + (HANG_UP - TILE_H) * (1 - easeIn(k)), sx: 0.92, sy: 1.12, eyes: 'wide', gaze: [0, 1] })],
    // The landing, a tap; it looks up at the cloud going.
    [
      LANDED,
      GONE,
      (k) => at(hang, { up: TILE_H, sx: 1 + 0.24 * arch(k * 2.5), sy: 1 - 0.24 * arch(k * 2.5), eyes: k < 0.25 ? 'shut' : 'happy', gaze: [0, -1] }),
    ],
    // Over the tiles.
    [
      GONE,
      HOPPED,
      (k) => {
        const n = k * (ROUTE.length - 1);
        const j = Math.min(ROUTE.length - 2, Math.floor(n));
        const from = tile(ROUTE[j]);
        const to = tile(ROUTE[j + 1]);
        return { ...hop(from, to, n - j, 26, { gaze: [Math.sign(to.out - from.out), 0.3] }), up: TILE_H };
      },
    ],
  ];
}

export const story: Story = {
  rests: [
    [0.12, GONE],
    [0.4, HOPPED],
  ],
  leave: 0.8,
  pose: (sec, room) => play(steps(room), sec),
};

/** When each tile was last landed on, by A-07's clock. */
const landings: [number, number][] = [
  [LANDED, HANG],
  ...ROUTE.slice(1).map((k, m): [number, number] => [GONE + HOP * (m + 1), k]),
];

export function stage(room: Room) {
  const { pen, sec, t } = room;
  const { pal } = pen;
  const o = room.fit(WIDTH);
  const hang = tileAt(o, HANG);

  // The tiles, back row first. One glows red after a landing; the last one
  // A-07 stands on keeps ringing while it rests there.
  const last = landings.filter(([at]) => sec >= at).pop();
  for (let k = COLS * 2 - 1; k >= 0; k--) {
    const out = o + (k % COLS) * STEP;
    const z = ROW_Z[Math.floor(k / COLS)];
    const top = room.box(out, 0, z, TILE, TILE_H, TILE, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
    const lit = landings.reduce((g, [at, tile]) => (tile === k && sec >= at ? Math.max(g, 1 - (sec - at) / 0.9) : g), 0);
    const held = last?.[1] === k ? 0.55 : 0;
    const glow = Math.max(lit, held);
    if (glow > 0) {
      pen.faded(glow, () => pen.box(top.x, top.y, z, TILE, TILE_H, TILE, { top: pal.red }));
      const ring = last?.[1] === k && sec - last[0] > 0.9 ? phase(t, 1.4, k) : span(sec - (last?.[0] ?? 0), 0, 0.9);
      pen.faded(1 - ring, () => pen.ring(top.x + TILE / 2, top.y, z + TILE / 2, 10 + ring * 44, pal.red, 1.5));
    }
  }

  // The cloud and its verdict.
  const cz = hang.z;
  const cx = room.x(hang.out, cz);
  const going = span(sec, SNAP, GONE);
  const cy = room.y - CLOUD_UP - 150 * easeIn(going);
  pen.faded(1 - going, () => {
    drawCloud(pen, cx, cy, cz, CLOUD_W);
    pen.text('CLOUD RELAY', cx, cy + CLOUD_W * 0.07, cz, { px: 8, color: pal.muted, align: 'center', base: 'middle', track: 0.12 });
  });
  pen.faded(span(sec, SNAP + 0.2, SNAP + 0.6) * 0.85, () =>
    pen.stamp('NO RELAY', cx, room.y - CLOUD_UP - CLOUD_W * 0.08, cz, pal.red, -0.12, 12),
  );

  const body = room.a07();
  if (!body || sec > SNAP + 0.3) return;
  // The cord, dashed like the hero's phantom relay: whole while it holds,
  // springing back both ways when it gives.
  const knot = [cx, cy + CLOUD_W * 0.2, cz] as const;
  const plug = [body.x, body.top, body.z] as const;
  const mid = [0, 1, 2].map((d) => (knot[d] + plug[d]) / 2);
  const toward = (a: readonly number[], k: number) => [0, 1, 2].map((d) => mix(mid[d], a[d], k)) as [number, number, number];
  const dash = [5, 4];
  if (sec <= SNAP) {
    pen.line(knot, plug, pal.ink, 1.5, dash);
    return;
  }
  const k = span(sec, SNAP, SNAP + 0.3);
  pen.faded(1 - k, () => {
    pen.line(knot, toward(knot, k), pal.ink, 1.5, dash);
    pen.line(plug, toward(plug, k), pal.ink, 1.5, dash);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const r = 4 + 18 * k;
      pen.line(
        [mid[0] + Math.cos(a) * r * 0.4, mid[1] + Math.sin(a) * r * 0.4, mid[2]],
        [mid[0] + Math.cos(a) * r, mid[1] + Math.sin(a) * r, mid[2]],
        i % 2 ? pal.red : pal.accent,
        1.5,
      );
    }
  });
}

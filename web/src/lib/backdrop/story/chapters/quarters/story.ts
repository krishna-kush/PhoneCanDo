// CH. 04, crew quarters, beside the Crew section. A-07 meets the crew: a
// cousin in the line for the phone flicks it a note; A-07 reads it, carries
// it to a cousin asleep on the floor and wakes it; then it joins the line
// for the one screen and waits its turn while the two ahead take theirs.

import { cousin } from '../../../species/look';
import { arch, easeInOut, jump, mix, span, stepLift } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { at, hop, play, walk, type Spot, type Step } from '../../a07/pose';
import { drawNote, drawScreen } from '../../props';
import type { Room } from '../../room';

const FIRST = cousin('quarters:first', { size: 22, gear: 'cap', pose: 'square' });
const SECOND = cousin('quarters:second', { size: 24, gear: 'antenna', pose: 'tall', swap: true });
const SLEEPER = cousin('quarters:sleeper', { size: 24, gear: 'none', pose: 'square' });
const PHONE = { w: 26, h: 46, z: 282 };

// Beats, seconds into the chapter.
const FLOWN = 1.0;
const CAUGHT = 1.4;
const READ = 2.4;
const AT_SLEEPER = 3.6;
const PASSED = 4.3;
const WOKEN = 5.0;
const QUEUED = 6.0;
// The two ahead take a turn each, then A-07: a step up, a tap, and off.
const TURN = 1.6;
const MINE = QUEUED + TURN * 2;
const TAPPED = MINE + 0.8;
// Within a turn: the tap, the one at the front leaving, the line stepping up.
const TAP_AT = 0.35;
const LEAVE_AT = 0.55;
const STEP_UP = [0.6, 0.95];

const layout = (room: Room) => {
  const o = room.fit(130);
  return {
    o,
    slots: [
      { out: o + 76, z: 250 },
      { out: o + 86, z: 210 },
      { out: o + 96, z: 170 },
    ] as Spot[],
    sleeper: { out: o + 16, z: 214 } as Spot,
    bedside: { out: o + 46, z: 196 } as Spot,
  };
};

function steps(room: Room): Step[] {
  const { slots, bedside } = layout(room);
  const h = room.hatch;
  const toward = (s: Spot): [number, number] => [Math.sign(s.out - h.out) * 0.8, -0.3];
  return [
    [0, FLOWN, () => at(h, { gaze: toward(slots[1]), eyes: 'wide' })],
    [FLOWN, CAUGHT, (k) => hop(h, h, k, 14, { gaze: [0, -1] })],
    [CAUGHT, READ, (k) => at(h, { gaze: [0, -1], eyes: k > 0.7 ? 'happy' : 'dot' })],
    [READ, AT_SLEEPER, (k) => walk(h, bedside, k)],
    [AT_SLEEPER, WOKEN, () => at(bedside, { gaze: [-1, 0.4] })],
    [WOKEN, QUEUED, (k) => walk(bedside, slots[2], k)],
    [QUEUED, QUEUED + TURN, (k) => advance(slots[2], slots[1], k)],
    [QUEUED + TURN, MINE, (k) => advance(slots[1], slots[0], k)],
    [MINE, TAPPED, (k) => hop(slots[0], slots[0], k, 12, { gaze: [0, -1], eyes: k > 0.5 ? 'happy' : 'dot' })],
  ];
}

/** A turn in the line: waiting while the one in front taps, then a step up as it goes. */
const advance = (from: Spot, to: Spot, k: number) => walk(from, to, span(k, STEP_UP[0], STEP_UP[1]), { gaze: [0, -0.6] });

export const story: Story = {
  rests: [
    [0.12, READ],
    [0.35, WOKEN],
    [0.6, TAPPED],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
};

export function stage(room: Room) {
  const { pen, sec, t } = room;
  const { pal } = pen;
  const { o, slots, sleeper, bedside } = layout(room);

  // The one phone, lit by each tap in turn.
  const phone = room.box(o + 63, 0, PHONE.z, PHONE.w, PHONE.h, 6, { front: pal.panel2, top: pal.panel, side: pal.panel2, stroke: pal.ink });
  const taps = [QUEUED + TURN * TAP_AT, QUEUED + TURN * (1 + TAP_AT), MINE + 0.2];
  const flash = Math.max(...taps.map((a) => arch(span(sec, a, a + 0.45))));
  drawScreen(pen, phone.x + 3, phone.y + 4, PHONE.z - 0.5, PHONE.w - 6, PHONE.h - 8, 5, -1, flash * 0.7);

  // The two ahead of A-07, each taking its turn and leaving outward.
  const ahead = [
    { name: 'quarters:first', look: FIRST, from: 0, leaves: QUEUED + TURN * LEAVE_AT },
    { name: 'quarters:second', look: SECOND, from: 1, leaves: QUEUED + TURN * (1 + LEAVE_AT) },
  ];
  for (const a of ahead) {
    const moved = a.from === 1 ? easeInOut(span(sec, QUEUED + TURN * STEP_UP[0], QUEUED + TURN * STEP_UP[1])) : 0;
    const base = { out: mix(slots[a.from].out, slots[0].out, moved), z: mix(slots[a.from].z, slots[0].z, moved) };
    const tapAt = taps[a.from];
    const tap = jump(span(sec, tapAt, tapAt + 0.4), 10);
    const off = span(sec, a.leaves, a.leaves + 1.2);
    if (off >= 1) continue;
    const out = base.out + off * 120;
    room.unit(a.name, a.look, {
      out,
      z: base.z - off * 40,
      lift: off > 0 ? stepLift(off * 60) : tap.lift,
      sx: tap.sx,
      sy: tap.sy,
      alpha: 1 - span(off, 0.6, 1),
      gaze: off > 0 ? [room.side, 0] : sec < FLOWN ? [-1, 0.2] : [0, -0.6],
    });
  }

  // The sleeper, flat out until the note wakes it.
  const woke = span(sec, PASSED, WOKEN);
  const j = jump(woke, 18);
  room.unit('quarters:sleeper', SLEEPER, {
    out: sleeper.out,
    z: sleeper.z,
    pose: woke > 0 ? 'square' : 'wide',
    lift: j.lift,
    sx: woke > 0 ? j.sx : 1,
    sy: woke > 0 ? j.sy : 0.92 + 0.04 * Math.sin(t * 1.4),
    eyes: woke <= 0 ? 'shut' : woke < 0.4 ? 'wide' : 'happy',
  });
  if (woke <= 0) {
    const zx = room.x(sleeper.out + 10, sleeper.z);
    for (let n = 0; n < 2; n++) {
      const q = (t * 0.4 + n * 0.5) % 1;
      pen.faded(arch(q), () => pen.text('z', zx + q * 8 * room.side, room.y - 30 - q * 30, sleeper.z, { px: 8 + q * 4, color: pal.muted }));
    }
  }

  room.a07();

  // The note: flicked from the line to A-07, held up to read, carried, slipped to the sleeper.
  const S = 26;
  const head = (s: Spot, lift = 0) => [room.x(s.out, s.z), room.y - S * 1.6 - lift, s.z] as const;
  let note: readonly [number, number, number] | null = null;
  if (sec < FLOWN) {
    const k = sec / FLOWN;
    const a = head(slots[1]);
    const b = head(room.hatch);
    note = [mix(a[0], b[0], k), mix(a[1], b[1], k) - arch(k) * 50, mix(a[2], b[2], k)];
  } else if (sec < AT_SLEEPER) {
    const a07 = room.actor?.pose;
    if (a07) note = head(a07, (a07.lift ?? 0) + 4);
  } else if (sec < PASSED) {
    const k = easeInOut(span(sec, AT_SLEEPER, PASSED));
    const a = head(bedside);
    const b = [room.x(sleeper.out, sleeper.z), room.y - 22, sleeper.z] as const;
    note = [mix(a[0], b[0], k), mix(a[1], b[1], k) - arch(k) * 16, mix(a[2], b[2], k)];
  } else if (sec < WOKEN + 0.6) {
    note = [room.x(sleeper.out, sleeper.z), room.y - 46 - span(sec, PASSED, WOKEN) * 10, sleeper.z];
  }
  if (note) drawNote(pen, note[0], note[1], note[2], 14, sec < FLOWN ? sec * 9 : Math.sin(t * 3) * 0.1);
}

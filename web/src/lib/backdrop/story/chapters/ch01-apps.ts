// CH. 01, beside the demos: the apps. The apps lie asleep on the glass, each
// in its square. Little reads their names one by one, then wakes one with a
// tap: Messages, with a note from your mom you hadn't answered. Then Clock,
// then Settings, grumbling, and the rest wake on their own: the phone comes
// alive under it.

import { momNote } from '../../../../data/backdrop';
import { easeOut, span } from '../../species/motion';
import type { Story } from '../../world/frame';
import { APP_NAMES, standApp, type AppKind } from '../characters/app';
import { at, hop, play, walk, type Spot, type Step } from '../a07/pose';
import type { Room } from '../room';

const SIZE = 26;
const STEP = 44;
const ROWS: { kind: AppKind; z: number }[][] = [
  [
    { kind: 'notes', z: 226 },
    { kind: 'maps', z: 226 },
    { kind: 'music', z: 226 },
  ],
  [
    { kind: 'messages', z: 170 },
    { kind: 'clock', z: 170 },
    { kind: 'settings', z: 170 },
  ],
];

const READ = 1.2;
const NAMED = 3.0;
const MESSAGES = 4.2;
const NOTED = 5.0;
const CLOCK = 6.0;
const SETTINGS = 7.0;
const ALIVE = 8.4;

const layout = (room: Room) => {
  const o = room.fit(STEP * 3 + 60);
  const at = (col: number) => o + 20 + col * STEP;
  return {
    o,
    at,
    side: { out: o + 20 + STEP * 3 + 12, z: 150 } as Spot,
    /** Where it stands to tap the front row's app in column [col]. */
    tap: (col: number): Spot => ({ out: at(col) + 18, z: 138 }),
  };
};

/** When each app wakes; one not named here, once the whole phone is alive. */
const WOKE: Partial<Record<AppKind, number>> = {
  messages: MESSAGES,
  clock: CLOCK,
  settings: SETTINGS,
  notes: SETTINGS + 0.5,
  maps: SETTINGS + 0.75,
  music: SETTINGS + 1.0,
};

function steps(room: Room): Step[] {
  const { side, tap } = layout(room);
  const left = -room.side;
  // A tap: up to the app, a small hop at it.
  const boop = (from: Spot, to: Spot) => (k: number) => (k < 0.7 ? walk(from, to, k / 0.7) : hop(to, to, (k - 0.7) / 0.3, 10, { gaze: [left, -0.3] }));
  return [
    [0, READ, (k) => walk(room.hatch, side, k)],
    // Reading their names, one after another along the rows.
    [READ, NAMED, (k) => at(side, { gaze: [left, k < 0.5 ? -0.5 : -0.1] })],
    [NAMED, MESSAGES, boop(side, tap(0))],
    [MESSAGES, NOTED, () => at(tap(0), { gaze: [left * 0.3, -1], eyes: 'wide' })],
    [NOTED, CLOCK, boop(tap(0), tap(1))],
    [CLOCK, SETTINGS, boop(tap(1), tap(2))],
    [SETTINGS, ALIVE, (k) => (k < 0.5 ? at(tap(2), { gaze: [left, -0.3] }) : hop(tap(2), tap(2), (k - 0.5) * 2, 22, { eyes: 'happy' }))],
  ];
}

export const story: Story = {
  rests: [
    [0.12, NAMED],
    [0.35, NOTED],
    [0.6, ALIVE],
  ],
  leave: 0.86,
  pose: (sec, room) => play(steps(room), sec),
  narrate: [0, READ, MESSAGES + 0.2, CLOCK],
};

export function draw(room: Room) {
  if (room.side < 0) return;
  const { pen, sec } = room;
  const { pal } = pen;
  const { at: colAt } = layout(room);
  const reading = span(sec, READ, NAMED);
  ROWS.forEach((row, r) => {
    row.forEach(({ kind, z }, col) => {
      const woke = WOKE[kind] ?? ALIVE;
      const awake = span(sec, woke, woke + 0.3);
      const b = standApp(room, kind, colAt(col), z, SIZE, {
        awake,
        hop: sec > woke && sec < woke + 0.6 ? (sec - woke) / 0.6 : null,
        gaze: -room.side * 0.5,
        unread: kind === 'messages' && sec >= MESSAGES,
        grumble: kind === 'settings' ? span(sec, SETTINGS, SETTINGS + 0.2) * (1 - span(sec, SETTINGS + 0.6, SETTINGS + 1)) : 0,
      });
      // Its name, as Little reads it: front row first, then the back.
      const order = (1 - r) * 3 + col;
      const named = span(reading, order / 6, order / 6 + 0.2);
      if (named > 0) {
        pen.faded(named, () =>
          pen.text(APP_NAMES[kind].toUpperCase(), b.left + b.w / 2, room.y + 9, z, {
            px: 6.5,
            color: pal.muted,
            align: 'center',
            track: 0.1,
          }),
        );
      }
      // The ripple of the tap that woke it.
      const ring = span(sec, woke, woke + 0.7);
      if (r === 1 && ring > 0 && ring < 1) pen.faded(1 - ring, () => pen.ring(b.left + b.w / 2, room.y, z, 10 + ring * 40, pal.red, 1.5));
    });
  });
  room.a07();

  // Mom's note, held up by Messages once it is awake.
  const note = easeOut(span(sec, MESSAGES + 0.2, MESSAGES + 0.7));
  if (note > 0) {
    const z = 168;
    const x = room.x(colAt(0), z);
    const y = room.y - SIZE * 2.2 - note * 14;
    pen.faded(note, () => {
      const text = `mom: ${momNote.asks}`;
      const w = pen.measure(text, z, { px: 8 }) / pen.scale(z) + 14;
      pen.rect(x - w / 2, y - 14, w, 18, z, pal.bg, pal.red);
      pen.line([x - 4, y + 4, z], [x - 9, y + 11, z], pal.red);
      pen.text(text, x, y - 2, z, { px: 8, color: pal.fg, align: 'center' });
    });
  }
}

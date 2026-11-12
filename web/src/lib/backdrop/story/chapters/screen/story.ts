// CH. 01, the screen, beside the demos. A-07 learns to use the phone: it
// hops over the keys to the screen and reads it row by row, then tries
// typing and gets it wrong ("jsut"), shakes it off, and types "just ask"
// properly; the line goes out and the screen lights up.

import { arch, phase, span } from '../../../species/motion';
import type { Story } from '../../../world/frame';
import { at, hop, play, type Pose, type Spot, type Step } from '../../a07/pose';
import { drawScreen } from '../../props';
import type { Room } from '../../room';

const KEYS = ['j', 'u', 's', 't', '␣', 'a', 'k'];
const KEY = 15;
const GAP = 4;
const KEY_H = 8;
const KEYS_Z = 110;
const WIDTH = KEYS.length * (KEY + GAP) - GAP;
const SCREEN = { w: 58, h: 96, z: 236 };

const WRONG = 'jsut';
const RIGHT = 'just ask';
// When each beat happens, seconds into the chapter.
const READ = 0.9;
const READ_END = 2.6;
const TRY = 3.4;
const TAP = 0.5;
const TRIED = TRY + TAP * (WRONG.length - 1);
const SULKED = TRIED + 0.9;
const AGAIN = SULKED + 0.5;
const TAP_RIGHT = 0.45;
const TYPED = AGAIN + TAP_RIGHT * (RIGHT.length - 1);
const SENT = TYPED + 0.85;

const keyFor = (c: string) => KEYS.indexOf(c === ' ' ? '␣' : c);
const keyAt = (o: number, k: number): Spot => ({ out: o + k * (KEY + GAP) + KEY / 2, z: KEYS_Z + KEY / 2 });
const readingSpot = (o: number): Spot => ({ out: o + WIDTH / 2, z: 182 });

/** Hopping key to key through [word], one letter every [per] seconds, as k runs over [length] seconds. */
function typing(o: number, word: string, per: number, k: number, length: number): Pose {
  const sec = k * length;
  const n = Math.min(word.length - 2, Math.floor(sec / per));
  const from = keyAt(o, keyFor(word[n]));
  const to = keyAt(o, keyFor(word[n + 1]));
  return { ...hop(from, to, sec / per - n, 14, { gaze: [0, 1] }), up: KEY_H };
}

function steps(room: Room): Step[] {
  const o = room.fit(WIDTH);
  const read = readingSpot(o);
  const first = keyAt(o, keyFor(WRONG[0]));
  return [
    [0, READ, (k) => hop(room.hatch, read, k, 30)],
    // Reading, leaning in, eyes on the lit row.
    [READ, READ_END, (k) => at(read, { sy: 1.04, gaze: [0.2 * Math.sin(k * 14), -0.9] })],
    [READ_END, TRY, (k) => ({ ...hop(read, first, k, 24), up: KEY_H * span(k, 0.6, 1) })],
    [TRY, TRIED, (k) => typing(o, WRONG, TAP, k, TRIED - TRY)],
    // That's not it: a shake, then a sulk.
    [
      TRIED,
      SULKED,
      (k) => ({
        ...at(keyAt(o, keyFor('t')), { up: KEY_H, eyes: k < 0.6 ? 'shut' : 'sleepy' }),
        out: keyAt(o, keyFor('t')).out + Math.sin(k * 40) * 3 * (1 - k),
      }),
    ],
    [SULKED, AGAIN, (k) => ({ ...hop(keyAt(o, keyFor('t')), first, k, 18), up: KEY_H })],
    [AGAIN, TYPED, (k) => typing(o, RIGHT, TAP_RIGHT, k, TYPED - AGAIN)],
    // Sent: a big hop on the last key.
    [TYPED, SENT, (k) => ({ ...hop(keyAt(o, keyFor('k')), keyAt(o, keyFor('k')), k, 34, { eyes: 'happy' }), up: KEY_H })],
  ];
}

export const story: Story = {
  rests: [
    [0.15, READ_END],
    [0.38, SULKED],
    [0.6, SENT],
  ],
  leave: 0.85,
  pose: (sec, room) => play(steps(room), sec),
};

/** The line on the keys at sec, and whether it was wrong. */
function typed(sec: number): { text: string; wrong: boolean; sent: boolean } {
  if (sec < TRY) return { text: '', wrong: false, sent: false };
  if (sec < SULKED) return { text: WRONG.slice(0, 1 + Math.floor((sec - TRY) / TAP)), wrong: sec >= TRIED, sent: false };
  if (sec < AGAIN) return { text: '', wrong: false, sent: false };
  return { text: RIGHT.slice(0, 1 + Math.floor((sec - AGAIN) / TAP_RIGHT)), wrong: false, sent: sec >= TYPED };
}

/** When the last key was landed on, by sec. */
function lastPress(sec: number): { key: number; at: number } | null {
  const tap = (word: string, start: number, per: number) =>
    sec >= start && sec < start + per * word.length
      ? { key: keyFor(word[Math.floor((sec - start) / per)]), at: start + Math.floor((sec - start) / per) * per }
      : null;
  return tap(WRONG, TRY, TAP) ?? tap(RIGHT, AGAIN, TAP_RIGHT);
}

export function stage(room: Room) {
  const { pen, sec, t } = room;
  const { pal } = pen;
  const o = room.fit(WIDTH);

  // The phone, standing behind the keys.
  const s = room.box(o + (WIDTH - SCREEN.w) / 2, 0, SCREEN.z, SCREEN.w, SCREEN.h, 8, {
    front: pal.panel2,
    top: pal.panel,
    side: pal.panel2,
    stroke: pal.ink,
  });
  const reading = span(sec, READ, READ_END);
  const lit = reading > 0 && reading < 1 ? Math.floor(reading * 6) : -1;
  const flash = sec >= TYPED ? arch(span(sec, TYPED, SENT)) * 0.6 : 0;
  drawScreen(pen, s.x + 4, s.y + 6, SCREEN.z - 0.5, SCREEN.w - 8, SCREEN.h - 12, 6, lit, flash);

  // A-07 behind the keys is drawn before them, on or in front of them after.
  if ((room.actor?.pose.z ?? 0) > KEYS_Z + KEY) room.a07();

  // The keys, pressed down for a beat when landed on.
  const press = lastPress(sec);
  KEYS.forEach((label, k) => {
    const down = press?.key === k ? 1 - span(sec - press.at, 0.05, 0.25) : 0;
    const h = KEY_H - 3 * down;
    const top = room.box(o + k * (KEY + GAP), 0, KEYS_Z, KEY, h, KEY, {
      front: down > 0 ? pal.red : pal.panel2,
      top: pal.panel,
      side: pal.panel2,
      stroke: pal.ink,
    });
    pen.text(label, top.x + KEY / 2, top.y + h / 2 + 0.5, KEYS_Z, {
      px: 7,
      color: down > 0 ? pal.onPrimary : pal.ink,
      align: 'center',
      base: 'middle',
    });
  });
  room.a07();

  // What it has typed, over the keys, with a caret.
  const line = typed(sec);
  const x = room.x(o + WIDTH / 2, KEYS_Z);
  const y = room.y - 74;
  const caret = phase(t, 1) < 0.55 ? '▌' : ' ';
  pen.text(line.text + (line.sent ? '' : caret), x, y, KEYS_Z, {
    px: 11,
    color: line.wrong ? pal.red : pal.fg,
    align: 'center',
    track: 0.04,
  });
  if (line.wrong) pen.stamp('✕ TYPO', x, y - 20, KEYS_Z, pal.red, -0.1, 8);
  if (line.sent) pen.faded(span(sec, TYPED, TYPED + 0.3), () => pen.stamp('SENT ✓', x, y - 20, KEYS_Z, pal.red, -0.08, 8));
}

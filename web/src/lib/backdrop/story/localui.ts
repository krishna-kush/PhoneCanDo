// A chat on a phone's glass, drawn the manual's way: dark glass (dark in
// both themes, as the page's screens are), a status bar with the signal (or
// none) and an "on device" badge, the other person's name, and the messages:
// theirs on the left, this phone's on the right in red, each sliding up into
// place as it arrives, with a small note under it (queued, sent).

import type { Pen } from '../paint/pen';
import { easeOut, span } from '../species/motion';

export type Bubble = {
  /** In from the other person, or out from this phone. */
  from: 'in' | 'out';
  text: string;
  /** When it arrived, story seconds. */
  at: number;
  /** A line under it: "queued · no signal", "sent ✓". */
  note?: string;
};

const PX = 7;
const PAD = 5;

export type Chat = {
  /** Who it is with, over the messages. */
  title: string;
  bubbles: Bubble[];
  /** The phone has no signal: its bars struck out. */
  offline: boolean;
  /** Someone is typing: dots under the last message. */
  typing: boolean;
};

/** The chat on the glass at (x, y), w by h, at story second [sec]. */
export function drawChat(pen: Pen, x: number, y: number, z: number, w: number, h: number, chat: Chat, sec: number, t: number) {
  const { pal } = pen;
  pen.rect(x, y, w, h, z, pal.artBg);
  // Status bar: signal bars (struck out when there are none), the badge.
  const bar = 12;
  for (let k = 0; k < 4; k++) pen.rect(x + PAD + k * 3.5, y + 8 - k * 1.5, 2.2, 2 + k * 1.5, z, chat.offline ? pal.artDim : pal.artFg);
  if (chat.offline) pen.line([x + PAD - 1, y + 9, z], [x + PAD + 14, y + 2, z], pal.red, 1.5);
  const badge = 'ON DEVICE';
  const bw = pen.measure(badge, z, { px: 5, track: 0.1 }) / pen.scale(z) + 6;
  pen.rect(x + w - PAD - bw, y + 2.5, bw, 8, z, undefined, pal.accent);
  pen.text(badge, x + w - PAD - bw / 2, y + 7, z, { px: 5, color: pal.accent, align: 'center', base: 'middle', track: 0.1 });
  pen.line([x, y + bar, z], [x + w, y + bar, z], pal.artDim);
  pen.text(chat.title, x + w / 2, y + bar + 9, z, { px: 6.5, color: pal.artFg, align: 'center', weight: 600 });

  // The messages, newest at the bottom; older ones go up and off the top.
  const dots = chat.typing ? 10 : 0;
  const head = bar + 14;
  const room = h - head - PAD - dots;
  const lead = PX * 1.25;
  const sized = chat.bubbles.map((b) => ({ ...b, h: lead + 5 + (b.note ? lead * 0.8 : 0) }));
  let used = 0;
  const kept: typeof sized = [];
  for (let i = sized.length - 1; i >= 0 && used + sized[i].h + 4 <= room; i--) {
    kept.unshift(sized[i]);
    used += sized[i].h + 4;
  }
  let by = y + h - PAD - dots - used;
  for (const b of kept) {
    const fresh = easeOut(span(sec, b.at, b.at + 0.45));
    const out = b.from === 'out';
    const textW = pen.measure(b.text, z, { px: PX }) / pen.scale(z);
    const bw = Math.min(w - PAD * 2, textW + 8);
    const bx = out ? x + w - PAD - bw : x + PAD;
    const ty = by + (1 - fresh) * 8;
    pen.faded(fresh, () => {
      pen.rect(bx, ty, bw, lead + 4, z, out ? pal.red : pal.artBg, out ? undefined : pal.artDim);
      pen.text(b.text, bx + 4, ty + lead * 0.85 + 1, z, { px: PX, color: out ? pal.onPrimary : pal.artFg });
      if (b.note) pen.text(b.note, out ? bx + bw : bx, ty + lead + 4 + lead * 0.7, z, { px: PX * 0.75, color: pal.artDim, align: out ? 'right' : 'left' });
    });
    by += b.h + 4;
  }
  if (chat.typing) {
    const n = Math.floor(t * 3) % 4;
    for (let k = 0; k < 3; k++) pen.faded(k < n ? 1 : 0.3, () => pen.rect(x + w - PAD - 18 + k * 5, y + h - PAD - 6, 3, 3, z, pal.artFg));
  }
}

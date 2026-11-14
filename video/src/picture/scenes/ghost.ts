// The hook (ghost.ts on the timeline): a phone on its own opens the group
// chat and types; a friend asks who's typing; then the screen becomes a
// window and the camera dives through it, into the phone.

import { outBack, outCubic, outExpo } from '../../motion/ease.ts';
import { noise } from '../../motion/noise.ts';
import { clamp, lerp, seg } from '../../motion/tween.ts';
import { ghost as G } from '../../timeline/script/ghost.ts';
import { el, place, show } from '../el.ts';
import { makeChat } from '../parts/apps/chat.ts';
import { makeHome } from '../parts/apps/home.ts';
import { makePhone } from '../parts/phone.ts';
import { makeWords, rise, typeOn } from '../parts/words.ts';
import { byShape, type Stage } from '../stage.ts';
import type { Ctx, View } from './scene.ts';

type Layout = {
  col: { x: number; y: number; w: number; font: number; ay: number };
  phone: { x: number; y: number; h: number; r: number };
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { col: { x: 11, y: 52, w: 96, font: 13, ay: 0.5 }, phone: { x: 133, y: 53, h: 86, r: -3 } },
    { col: { x: 7, y: 16, w: 88, font: 12.5, ay: 0 }, phone: { x: 50, y: 113, h: 84, r: -2 } },
    { col: { x: 7, y: 52, w: 52, font: 8.6, ay: 0.5 }, phone: { x: 75, y: 52, h: 72, r: -3 } },
  );

const BEFORE = [
  { who: 'Sam', text: 'where are you??' },
  { who: 'Ana', text: 'we ordered already' },
];

/** The dive into the screen, from the friend's question to the next scene. */
const DIVE = 1.2;
const AT = G.at;

export function makeGhost({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  const col = el('div', 'pin', cam);
  col.style.width = `${L.col.w * st.u}px`;
  const fig = el('div', 'label fig', col);
  fig.style.marginBottom = `${2.6 * st.u}px`;
  const head = makeWords(col, '*Nobody* is touching this phone.');
  head.el.style.fontSize = `${L.col.font * st.u}px`;

  const phone = makePhone(cam, st, L.phone.h);
  const home = makeHome(phone.screen);
  const chat = makeChat(phone.screen, G.text.chat, BEFORE, G.text.message, { who: 'Sam', text: G.text.reply });
  const ripple = el('div', 'ripple', phone.screen);
  const pw = phone.w * st.u;

  // Where the taps land, read off the laid-out screen the first time it
  // shows (layout offsets, which no transform moves).
  let spots: { chat: [number, number]; send: [number, number] } | null = null;
  const measure = () => {
    const of = (e: HTMLElement): [number, number] => {
      let x = e.offsetWidth / 2;
      let y = e.offsetHeight / 2;
      for (let p: HTMLElement | null = e; p && p !== phone.screen; p = p.offsetParent as HTMLElement | null) {
        x += p.offsetLeft;
        y += p.offsetTop;
      }
      return [x, y];
    };
    const was = chat.el.style.display;
    chat.el.style.display = '';
    spots = { chat: of(home.chat), send: of(chat.send) };
    chat.el.style.display = was;
  };

  const tapAt = (t: number, at: number, [x, y]: [number, number]) => {
    const k = seg(t, at, at + 0.35, outCubic);
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.transform = `scale(${(0.3 + k * 1.3).toFixed(3)})`;
    ripple.style.opacity = t < at || k >= 1 ? '0' : (0.55 * (1 - k)).toFixed(3);
  };

  return {
    el: root,
    dive: DIVE,
    portal: () => ({ el: phone.screen, shape: 'box' }),
    sky: (b) => ({ gx: L.phone.x / st.W, gy: L.phone.y / st.H, dy: -b * 0.6, glow: 0.5 + 0.3 * seg(b, 0, 1), glowX: L.phone.x / st.W, glowY: L.phone.y / st.H, glowR: 55 }),
    frame(b) {
      if (!spots) measure();
      const sp = spots as NonNullable<typeof spots>;

      // A slow push in; the camera's own dive takes over at the end.
      cam.style.transformOrigin = '50% 50%';
      cam.style.transform = `scale(${(1 + 0.03 * seg(b, 0, 8)).toFixed(4)})`;

      // The words, on screen from the very first frame (a feed shows a video's first frame before it plays).
      place(col, st, { x: L.col.x, y: L.col.y, ax: 0, ay: L.col.ay });
      typeOn(fig, G.text.fig, b, AT.head - 2, 0.03);
      rise(head.words, b, AT.head - 2, 0);

      // The phone: settling in, floating, then squared up to be dived into.
      const enter = seg(b, -0.6, 0.5, outCubic);
      const square = 1 - seg(b, AT.peek - 0.3, AT.peek + 0.3, outCubic);
      place(phone.el, st, {
        x: L.phone.x,
        y: L.phone.y + (1 - enter) * 10 + noise(b * 0.35, 3) * 0.8 * square,
        r: (L.phone.r + noise(b * 0.25, 4) * 0.8) * square,
        o: enter,
      });

      // Home, the tap on the chat, the chat opening out of its icon.
      const open = seg(b, AT.open, AT.open + 0.3, outExpo);
      show(home.el, open < 1);
      show(chat.el, b >= AT.open);
      chat.el.style.transformOrigin = `${sp.chat[0]}px ${sp.chat[1]}px`;
      chat.el.style.transform = `scale(${lerp(0.12, 1, open).toFixed(4)})`;
      chat.el.style.opacity = String(clamp(open * 3));
      if (b < AT.send - 0.2) tapAt(b, AT.tap, sp.chat);
      else tapAt(b, AT.send, sp.send);

      // Typing: a key lit for each letter as it goes in.
      const msg = G.text.message;
      const typed = clamp(Math.floor((b - AT.type) / AT.key) + 1, 0, msg.length);
      const sent = b >= AT.send + 0.05;
      chat.field.textContent = sent ? '' : msg.slice(0, typed);
      chat.field.classList.toggle('empty', typed === 0 || sent);
      if (!sent && b >= AT.open) el('span', 'cur', chat.field).style.opacity = b % 0.5 < 0.25 || (typed > 0 && typed < msg.length) ? '1' : '0';
      const at = Math.floor((b - AT.type) / AT.key);
      const pressed = at >= 0 && at < msg.length && (b - AT.type) % AT.key < AT.key * 0.8 ? msg[at] : null;
      for (const [c, k] of chat.keys) k.classList.toggle('on', c === pressed);

      // Sent, and the reply.
      const out = seg(b, AT.send + 0.05, AT.send + 0.35, outBack(2));
      show(chat.mine, sent);
      chat.mine.style.transform = `translateY(${((1 - out) * pw * 0.12).toFixed(1)}px) scale(${lerp(0.6, 1, out).toFixed(3)})`;
      const back = seg(b, AT.reply, AT.reply + 0.3, outBack(2));
      show(chat.reply, b >= AT.reply);
      chat.reply.style.transform = `scale(${lerp(0.5, 1, back).toFixed(3)})`;
    },
  };
}

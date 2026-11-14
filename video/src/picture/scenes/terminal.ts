// Under the glass (terminal.ts on the timeline): the Linux plate's own
// terminal, the very one the camera dived into, filling the frame; it
// settles into place as the headline comes in, and an apt install races
// by. Then it starts the built-in agent, and the crew tows in the page of
// all of them.

import { inOutCubic } from '../../motion/ease.ts';
import { clamp, lerp, seg } from '../../motion/tween.ts';
import { terminal as T } from '../../timeline/script/terminal.ts';
import { el, place, show } from '../el.ts';
import { makeTerm } from '../parts/term.ts';
import { makeWords, rise } from '../parts/words.ts';
import { makeTow } from '../stagehands/tow.ts';
import { byShape, type Stage } from '../stage.ts';
import type { Ctx, View } from './scene.ts';

type Layout = {
  head: { x: number; y: number; w: number; font: number; ay: number };
  term: { x: number; y: number; w: number; h: number; font: number };
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { head: { x: 11, y: 50, w: 64, font: 10, ay: 0.5 }, term: { x: 121, y: 53, w: 96, h: 64, font: 2.9 } },
    { head: { x: 7, y: 16, w: 86, font: 10.5, ay: 0 }, term: { x: 50, y: 108, w: 90, h: 66, font: 2.9 } },
    { head: { x: 6, y: 9, w: 88, font: 7.2, ay: 0 }, term: { x: 50, y: 63, w: 88, h: 56, font: 2.4 } },
  );

/** The type size of the terminal, in u, wherever it is drawn (the Linux plate's copy too). */
export const termFont = (st: Stage) => layout(st).term.font;

const AT = T.at;

export function makeTerminal({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  const head = makeWords(cam, 'Under the glass, *a whole Linux.*');
  head.el.classList.add('pin');
  head.el.style.width = `${L.head.w * st.u}px`;
  head.el.style.fontSize = `${L.head.font * st.u}px`;
  const term = makeTerm(cam, st, L.term.font);

  return {
    el: root,
    gag: makeTow(st, { from: AT.tow, release: AT.release, end: T.beats }),
    sky: (t) => ({ gx: 0.5, gy: 0.5, dy: -t * 2, glow: 0.45, glowX: L.term.x / st.W, glowY: L.term.y / st.H, glowR: 80 }),
    frame(t) {
      place(head.el, st, { x: L.head.x, y: L.head.y, ax: 0, ay: L.head.ay });
      rise(head.words, t, AT.settle * 0.6, 0.1);

      // The plate's terminal fills the frame as the dive lands, then settles into its place.
      const k = seg(t, 0, AT.settle, inOutCubic);
      const w = lerp(st.W, L.term.w, k);
      const h = lerp(st.H, L.term.h, k);
      term.el.style.width = `${w * st.u}px`;
      term.el.style.height = `${h * st.u}px`;
      term.pad(k);
      place(term.el, st, { x: lerp(st.W / 2, L.term.x, k), y: lerp(st.H / 2, L.term.y, k) });

      // The command, typed; then apt's lines, a progress bar racing among them.
      const cmd = T.text.cmd;
      const n = clamp(Math.floor((t - AT.type) / AT.key) + 1, 0, cmd.length);
      const blink = t < 0 || (t * 2) % 2 < 1.2;
      term.typed.textContent = ` ${cmd.slice(0, n)}`;
      const entered = t >= AT.enter;
      term.cmdCur.style.opacity = !entered && (blink || (n > 0 && n < cmd.length)) ? '1' : '0';
      let html = '';
      T.text.lines.forEach((line, i) => {
        const at = AT.lines + i * AT.line;
        if (t < at) return;
        html += `<span class="dim">${line}</span>\n`;
        if (i === 2) {
          const p = clamp((t - at) / (AT.line * 2.6));
          const filled = Math.round(p * 24);
          html += `<span class="ok">[${'#'.repeat(filled)}${'.'.repeat(24 - filled)}]</span> ${Math.round(p * 100)}%\n`;
        }
      });
      if (t >= AT.done) html += `<span class="ok">${T.text.done}</span>\n`;
      if (term.out.dataset.k !== html) term.out.innerHTML = term.out.dataset.k = html;

      // The next prompt: the built-in agent typed and started.
      show(term.next, t >= AT.done);
      const a = T.text.agent;
      const m = clamp(Math.floor((t - AT.agent) / AT.key) + 1, 0, a.length);
      term.nextTyped.textContent = ` ${a.slice(0, m)}`;
      term.cur.style.opacity = t < AT.run && (blink || (m > 0 && m < a.length)) ? '1' : '0';
      term.last.textContent = t >= AT.run + 0.15 ? T.text.starting : '';
    },
  };
}

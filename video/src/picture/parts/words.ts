// Headlines that move a word at a time. A *starred* word takes the site's
// red italic. Each animation sets every word outright from the time, from
// before its start (hidden) to after its end (resting).

import { inCubic, outBack, outCubic } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { el } from '../el.ts';

export type Words = { el: HTMLElement; words: HTMLElement[] };

/** A headline from [text] in [cls], each word its own span. */
export function makeWords(parent: Element, text: string, cls = 'head'): Words {
  const box = el('div', cls, parent);
  const words: HTMLElement[] = [];
  const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
  for (const part of parts) {
    const starred = part.startsWith('*');
    const holder = starred ? el('em', '', box) : box;
    const ws = (starred ? part.slice(1, -1) : part).split(/(\s+)/);
    for (const w of ws) {
      if (!w) continue;
      if (/^\s+$/.test(w)) holder.appendChild(document.createTextNode(' '));
      else words.push(el('span', 'w', holder, w));
    }
  }
  return { el: box, words };
}

const set = (w: HTMLElement, transform: string, opacity: number, blur = 0) => {
  w.style.transform = transform;
  w.style.opacity = opacity.toFixed(3);
  w.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : '';
};

/** Words slamming down from big, [step] beats apart from [at], each over [len]. */
export function slam(ws: readonly HTMLElement[], t: number, at: number, step = 0.25, len = 0.16) {
  ws.forEach((w, i) => {
    const k = seg(t, at + i * step, at + i * step + len, inCubic);
    const settle = seg(t, at + i * step + len, at + i * step + len + 0.3, outBack(3));
    const s = k < 1 ? 2.6 - 1.6 * k : 0.94 + 0.06 * settle;
    set(w, `scale(${s.toFixed(4)})`, Math.min(1, k * 3), (1 - k) * 6);
  });
}

/** Words rising into place, [step] beats apart from [at]. */
export function rise(ws: readonly HTMLElement[], t: number, at: number, step = 0.12, len = 0.4) {
  ws.forEach((w, i) => {
    const k = seg(t, at + i * step, at + i * step + len, outCubic);
    set(w, `translateY(${((1 - k) * 0.55).toFixed(3)}em)`, k, (1 - k) * 5);
  });
}

/** Words flying off, [step] beats apart from [at]; [dir] -1 up, 1 down. */
export function leave(ws: readonly HTMLElement[], t: number, at: number, step = 0.05, len = 0.25, dir = -1) {
  if (t < at) return;
  ws.forEach((w, i) => {
    const k = seg(t, at + i * step, at + i * step + len, inCubic);
    if (k <= 0) return;
    set(w, `translateY(${(dir * k * 0.8).toFixed(3)}em) scale(${(1 + k * 0.2).toFixed(3)})`, 1 - k, k * 8);
  });
}

/** Typed out, a character every [rate] beats from [at], with the block cursor while it types or [blink]s after. */
export function typeOn(box: HTMLElement, text: string, t: number, at: number, rate = 0.05, blink = false) {
  const n = Math.max(0, Math.min(text.length, Math.floor((t - at) / rate) + 1));
  const typing = t >= at && n < text.length;
  const on = typing || (blink && t >= at && Math.floor((t - at) * 2) % 2 === 0);
  const shown = t < at ? '' : text.slice(0, n);
  const key = `${shown}|${on}`;
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  box.textContent = shown;
  if (on) el('span', 'cur', box);
}


// The phone, as the site draws Model A-01: 9 by 19.5, a dark body on the
// brand's hard amber offset, a punch-hole camera, a status bar. Scenes
// fill its screen.

import { el } from '../el.ts';
import type { Stage } from '../stage.ts';

export type Phone = {
  /** A .pin; place() it. */
  el: HTMLElement;
  screen: HTMLElement;
  /** Its size, in u. */
  w: number;
  h: number;
};

export const PHONE_ASPECT = 9 / 19.5;

/** A phone [h] u tall, its status bar reading [time]. */
export function makePhone(parent: Element, st: Stage, h: number, time = '9:41'): Phone {
  const w = h * PHONE_ASPECT;
  const body = el('div', 'phone', parent);
  body.style.setProperty('--pw', `${w * st.u}px`);
  body.style.setProperty('--ph', `${h * st.u}px`);
  const screen = el('div', 'screen', body);
  el('div', 'cam', body);
  const power = el('div', 'key', body);
  power.style.top = '24%';
  power.style.height = '9%';
  const volume = el('div', 'key', body);
  volume.style.top = '36%';
  volume.style.height = '14%';
  const status = el('div', 'status', screen);
  el('span', '', status, time);
  el('span', '', status, '5G 100%');
  return { el: body, screen, w, h };
}

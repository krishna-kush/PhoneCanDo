// A group chat: who's in it, what they said, a field being typed into and
// a keyboard whose keys light as each letter goes in.

import { el } from '../../el.ts';

export type Said = { who: string; text: string };

export type Chat = {
  el: HTMLElement;
  field: HTMLElement;
  send: HTMLElement;
  /** The message we send, and the reply to it; hidden until shown. */
  mine: HTMLElement;
  reply: HTMLElement;
  /** Each letter's key, space as ' '. */
  keys: Map<string, HTMLElement>;
};

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** People in the chat, by initial and ink. */
const FACES: [string, string][] = [
  ['S', 'var(--amber)'],
  ['A', 'var(--term-blue)'],
  ['J', 'var(--term-green)'],
];

export function makeChat(screen: HTMLElement, name: string, before: readonly Said[], mine: string, reply: Said): Chat {
  const app = el('div', 'chatapp', screen);
  const top = el('div', 'top', app);
  const faces = el('div', 'faces', top);
  for (const [initial, ink] of FACES) el('div', 'face', faces, initial).style.background = ink;
  const title = el('div', 'name', top, name);
  el('small', '', title, `${FACES.length} people`);

  const log = el('div', 'log', app);
  const said = (s: Said, cls = 'msg') => {
    const m = el('div', cls, log);
    if (s.who) el('b', '', m, s.who);
    m.appendChild(document.createTextNode(s.text));
    return m;
  };
  for (const s of before) said(s);
  const sent = said({ who: '', text: mine }, 'msg mine');
  const back = said(reply);

  const input = el('div', 'input', app);
  const field = el('div', 'field', input);
  const send = el('div', 'send', input);
  el('i', '', send);

  const keys = new Map<string, HTMLElement>();
  const board = el('div', 'keys', app);
  for (const row of ROWS) {
    const r = el('div', 'row', board);
    for (const c of row) {
      const k = el('div', 'k', r, c);
      el('span', 'tip', k, c);
      keys.set(c, k);
    }
  }
  const last = el('div', 'row', board);
  el('div', 'k', last, ',');
  keys.set(' ', el('div', 'k wide', last, 'space'));
  el('div', 'k', last, '.');
  return { el: app, field, send, mine: sent, reply: back, keys };
}

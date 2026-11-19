// A home screen: a grid of apps and a dock, the chat app in amber where a
// thumb would find it.

import { el } from '../../el.ts';

export type Home = { el: HTMLElement; chat: HTMLElement };

const CHAT = 9;
const RED = 2;

export function makeHome(screen: HTMLElement): Home {
  const home = el('div', 'home', screen);
  const grid = el('div', 'grid', home);
  let chat = home;
  for (let i = 0; i < 16; i++) {
    const app = el('div', `app${i === CHAT ? ' chat' : i === RED ? ' red' : ''}`, grid);
    el('i', '', app);
    if (i === CHAT) chat = app;
  }
  const dock = el('div', 'dock', home);
  for (let i = 0; i < 4; i++) el('i', '', el('div', 'app', dock));
  return { el: home, chat };
}

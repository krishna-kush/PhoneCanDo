// What the app's Choose agent step tells about a kind (`about`), as of the
// day it was checked: who makes it, its official links (all https), the free
// use its makers offer and its power move (what to type, what it does). Shown only: nothing runs
// from it, so it is checked for shape alone.
import { fields, oneOf, string, text, type Add, type Json } from './primitives.ts';
import { ABOUT_KEYS, ABOUT_LINKS, FREE_VIA, MAX, PATTERNS } from './rules.ts';

export function checkAbout(add: Add, value: unknown) {
  if (!fields(add, '/about', value, ABOUT_KEYS, ['checked'])) return;
  const a = value as Json;
  string(add, '/about/checked', a.checked, PATTERNS.day);
  if ('maker' in a) text(add, '/about/maker', a.maker);
  if ('links' in a && fields(add, '/about/links', a.links, ABOUT_LINKS, [])) {
    const links = a.links as Json;
    if (Object.keys(links).length === 0) add('/about/links', 'required', 'name at least one link, or leave links out');
    for (const key of ABOUT_LINKS) string(add, `/about/links/${key}`, links[key], PATTERNS.url, MAX.url);
  }
  if ('free' in a && fields(add, '/about/free', a.free, ['via', 'note'], ['via', 'note'])) {
    const free = a.free as Json;
    oneOf(add, '/about/free/via', free.via, FREE_VIA);
    text(add, '/about/free/note', free.note, MAX.freeNote);
  }
  if ('move' in a && fields(add, '/about/move', a.move, ['keys', 'does'], ['keys', 'does'])) {
    const move = a.move as Json;
    text(add, '/about/move/keys', move.keys, MAX.moveKeys);
    text(add, '/about/move/does', move.does, MAX.moveDoes);
  }
}

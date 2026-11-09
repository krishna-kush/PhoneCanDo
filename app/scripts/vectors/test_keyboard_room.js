// The room under a terminal while the keyboard moves (src/ui/terminal/
// sizing.ts terminalPad, a worklet run on the UI thread every frame): the
// footer stays put while the keyboard opens over it, so a terminal above the
// footer leaves room only for the part of the keyboard above it. The room
// under the terminal (pad + footer) is then the larger of the two, and moves
// with the keyboard step for step, never jumping; a terminal with no footer
// below follows the keyboard as is. Imports the real pure module (Node
// 22.18+ strips its types).
// Run: node test_keyboard_room.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${ok ? '' : ` got=${q(got)} want=${q(want)}`}`);
}
// import() wants a URL: a bare Windows path (C:\...) is not one.
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;

(async () => {
  const { terminalPad } = await import(src('ui/terminal/sizing.ts'));
  const FOOTER = 57;
  const room = (k) => terminalPad(k, FOOTER, true) + FOOTER;

  t('closed: no pad', terminalPad(0, FOOTER, true), 0);
  t('within the footer: no pad', terminalPad(40, FOOTER, true), 0);
  t('open: the keyboard above the footer', terminalPad(354, FOOTER, true), 354 - FOOTER);
  t('the room is the larger of the two', [room(0), room(40), room(57), room(58), room(354)], [57, 57, 57, 58, 354]);

  // A close, as the keyboard's steps came on our Moto: the room follows each
  // step down to the footer and never jumps by more than the keyboard moved.
  const steps = [354, 349, 326, 258, 224, 194, 169, 149, 130, 115, 100, 88, 77, 67, 58, 50, 43, 36, 30, 25, 20, 16, 12, 8, 4, 1, 0];
  const rooms = steps.map(room);
  t('a close never grows the terminal back', rooms.every((r, i) => i === 0 || r <= rooms[i - 1]), true);
  t('no jump bigger than the keyboard step', rooms.every((r, i) => i === 0 || rooms[i - 1] - r <= steps[i - 1] - steps[i]), true);
  t('it ends at the footer', rooms[rooms.length - 1], FOOTER);

  t('no footer below: the keyboard as is', [terminalPad(30, FOOTER, false), terminalPad(0, FOOTER, false)], [30, 0]);

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

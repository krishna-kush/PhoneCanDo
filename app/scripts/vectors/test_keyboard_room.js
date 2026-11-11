// The room under a terminal while the keyboard moves (src/ui/terminal/
// sizing.ts spacerPad, a worklet run on the UI thread every frame by
// common/keyboard/KeyboardTracker.tsx): the keyboard's height above the
// bottom safe area (the nav bar it covers) plus a finger's breadth of air.
// Nothing sits below a terminal (no footer), so the spacer is that room as
// is, and it moves with the keyboard step for step, never jumping. Imports
// the real pure module (Node 22.18+ strips its types).
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
  const { spacerPad, KB_BREATHE } = await import(src('ui/terminal/sizing.ts'));
  const INSET = 48;
  // KeyboardTracker: a closed keyboard (height 0) leaves no room at all.
  const room = (k) => (k > 0 ? spacerPad(k, INSET) : 0);

  t('closed: no room', room(0), 0);
  t('open: above the nav bar, plus air', spacerPad(354, INSET), 354 - INSET + KB_BREATHE);
  t('never below zero', spacerPad(10, INSET), 0);

  // A close, as the keyboard's steps came on our Moto: the room follows each
  // step down and never jumps by more than the keyboard moved.
  const steps = [354, 349, 326, 258, 224, 194, 169, 149, 130, 115, 100, 88, 77, 67, 58, 50, 43, 36, 30, 25, 20, 16, 12, 8, 4, 1, 0];
  const rooms = steps.map(room);
  t('a close never grows the terminal back', rooms.every((r, i) => i === 0 || r <= rooms[i - 1]), true);
  t('no jump bigger than the keyboard step', rooms.slice(0, -1).every((r, i) => i === 0 || rooms[i - 1] - r <= steps[i - 1] - steps[i]), true);
  t('it ends with no room', rooms[rooms.length - 1], 0);

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

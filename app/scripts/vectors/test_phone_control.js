// The top of Settings (src/ui/settings/phone-control/copy.ts): A-01's board
// line, and the phone-control panel's status, which adds up Android's
// Accessibility switch and our lock and never says more than they do.
// Imports the real pure module (Node 22.18+ strips its types), so these
// cannot drift.
// Run: node test_phone_control.js (or pnpm check:vectors)
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
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;

(async () => {
  const c = await import(src('ui/settings/phone-control/copy.ts'));
  const l = await import(src('ui/common/face/lines.ts'));

  t('board: its settings line before a tap', c.boardLine(2, 0), l.settingsLine(2));
  t('board: a boop line per tap', [c.boardLine(2, 1), c.boardLine(2, 2)], [l.boopLine(0), l.boopLine(1)]);

  // The level never reaches "on" without both keys.
  t('switch off: off, whatever the lock', [c.handsLevel(false, false, false), c.handsLevel(false, false, true)], ['off', 'off']);
  t('switched on, service not up yet', c.handsLevel(true, false, true), 'starting');
  t('service up, locked: ready', c.handsLevel(true, true, false), 'ready');
  t('service up, unlocked: on', c.handsLevel(true, true, true), 'on');
  t('moods', ['off', 'starting', 'ready', 'on'].map(c.handsMood), ['asleep', 'busy', 'awake', 'awake']);
  t('every level has a stamp', ['off', 'starting', 'ready', 'on'].every((k) => c.HANDS_STAMP[k].length > 0), true);
  t('ready says who unlocks', [c.handsLine('ready', false), c.handsLine('ready', true)], [
    'ready · locked until you unlock',
    'ready · each agent asks you first',
  ]);
  t('only "on" says eyes and hands', ['off', 'starting', 'ready', 'on'].map((k) => c.handsLine(k, false).includes('eyes and hands')), [false, false, false, true]);

  t('no phone control: the line as it always read', c.noHandsLine('lite'), 'This lite build has no screen automation. Notifications, clipboard, and opening links still work.');
  t('no phone control: the stamp', c.noHandsStamp('play'), 'not in play');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

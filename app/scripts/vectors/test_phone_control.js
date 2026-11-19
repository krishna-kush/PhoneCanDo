// The top of Settings (src/ui/settings/phone-control/copy.ts): A-01's board
// line, and the phone-control panel's status, which adds up Android's
// Accessibility switch and our lock and never says more than they do; and
// Auto off's time card (src/ui/accessibility/auto-off/copy.ts).
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
  const a = await import(src('ui/accessibility/auto-off/copy.ts'));

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

  t('auto off: the card punches IN then OUT', a.cardLines(true).map((x) => x.punch), ['IN', 'OUT']);
  t('auto off: IN reads the same either way', a.cardLines(true)[0], a.cardLines(false)[0]);
  t('auto off: OUT says when it clocks out', [a.cardLines(true)[1].when, a.cardLines(false)[1].when], [
    '10 s after you leave PhoneCanDo, if no agent needs the phone',
    'only when you switch it off',
  ]);
  t('auto off: the box tells how long either way', [a.boxBody(true), a.boxBody(false)].every((n) => n.includes('10 seconds after you leave')), true);
  // The seconds and minutes it tells are the ones native times it by.
  const rules = require('node:fs').readFileSync(
    path.join(__dirname, '../../modules/phonecando-runner/android/src/main/java/com/phonecando/runner/autooff/AutoOffRules.kt'),
    'utf8',
  );
  const ms = (name) => Number((rules.match(new RegExp(`${name} = ([0-9_]+)L`)) ?? [, 'NaN'])[1].replaceAll('_', ''));
  t('auto off: the quiet it tells is native\'s', a.QUIET_SECONDS * 1000, ms('QUIET_MS'));
  t('auto off: the warm-up it tells is native\'s', a.WARM_UP_MINUTES * 60_000, ms('WARM_UP_MS'));
  t('auto off: the stamp', [a.cardStamp(true), a.cardStamp(false)], ['auto', 'by hand']);
  t('auto off: the box names the bank apps either way', [a.boxBody(true), a.boxBody(false)].every((n) => n.includes('bank apps')), true);
  t('auto off: off, the box worries as the ask does', a.boxTitle(false), a.ASK_TITLE);
  t('auto off: a quip per flip, round and round', [1, 2, 3, 4].map((n) => a.flipLine(true, n)), [
    "clocking out when you're done",
    'bank apps can come out now',
    "i'll slip out quietly",
    "clocking out when you're done",
  ]);
  t('auto off: switched off, it says so', a.flipLine(false, 1), 'back on duty');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

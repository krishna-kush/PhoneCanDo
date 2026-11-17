// Settings → Look & feel (src/ui/settings/look/copy.ts): which scheme and
// mood each theme screen shows, the picked theme's line, and how far the
// extra keys preview's row drops. Imports the real pure module (Node
// 22.18+ strips its types), so these cannot drift.
// Run: node test_look_page.js (or pnpm check:vectors)
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
  const c = await import(src('ui/settings/look/copy.ts'));

  // --- schemes and moods ----------------------------------------------------------
  t('system follows a dark phone', c.schemeOf('system', 'dark'), 'dark');
  t('system follows a light phone', c.schemeOf('system', 'light'), 'light');
  t('light stays light on a dark phone', c.schemeOf('light', 'dark'), 'light');
  t('dark stays dark on a light phone', c.schemeOf('dark', 'light'), 'dark');
  t('A-01 is up in the light', c.moodOf('light', 'dark'), 'awake');
  t('A-01 naps in the dark', c.moodOf('dark', 'light'), 'asleep');
  t('system on a dark phone naps', c.moodOf('system', 'dark'), 'asleep');
  t('three screens, system first', c.THEME_MODES, ['system', 'light', 'dark']);
  t('every screen has a name', c.THEME_MODES.every((m) => c.THEME_LABEL[m].length > 0), true);

  // --- lines ----------------------------------------------------------------------
  t('system says what the phone is now', c.themeLine('system', 'dark'), 'Follows your phone · lights off now');
  t('light', c.themeLine('light', 'dark'), 'Lights on · A-01 is up');
  t('dark', c.themeLine('dark', 'light'), 'Lights off · A-01 naps');

  // --- extra keys -----------------------------------------------------------------
  t('two choices, with the keyboard first', c.KEYS_CHOICES.map((k) => k.sticky), [false, true]);
  t('keyboard up: the row sits on it', c.rowDrop(0, false, 60, 14), 0);
  t('keyboard gone: the row rides out with it', c.rowDrop(1, false, 60, 14), 74);
  t('keyboard gone, always up: the row stops at the foot', c.rowDrop(1, true, 60, 14), 60);
  t('halfway down, always up', c.rowDrop(0.5, true, 60, 14), 30);

  // --- the theme sweep ------------------------------------------------------------
  const f = await import(src('ui/common/face/change/specs.ts'));
  const ft = await import(src('ui/common/face/change/timing.ts'));
  t('lights on: the wake-up, then a beat with the eyes open', c.sweepHold('light'), ft.changeMs(f.REACTION.glare) + 130);
  t('lights off: wide, dozing off, then the nap for a beat', c.sweepHold('dark'), ft.changeMs(f.REACTION.startle) + 400);
  t('the holds', [c.sweepHold('light'), c.sweepHold('dark')], [780, 1070]);
  t('lights on: A-01 is still napping as the colour comes', f.REACTION.glare.sleepMs <= c.SWEEP.growMs, true);
  t('the colour covers the app before either hold ends', c.SWEEP.growMs < Math.min(c.sweepHold('light'), c.sweepHold('dark')), true);
  t('a fast lights-on takes 1.1 s at most', c.sweepHold('light') + c.SWEEP.fadeMs <= 1100, true);
  t('a fast lights-off takes 1.4 s at most', c.sweepHold('dark') + c.SWEEP.fadeMs <= 1400, true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

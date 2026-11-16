// When the update box opens by itself at launch
// (src/state/logic/updateOffer.ts): once per newer build, never in a debug
// build, not on lite while its offer is off. Imports the real pure module
// (Node 22.18+ strips its types), so it cannot drift.
// Run: node test_update_offer.js (or pnpm check:vectors)
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
  const { offerAtLaunch } = await import(src('state/logic/updateOffer.ts'));
  const base = { newer: 5, offered: 0, debug: false, lite: false, muted: false };

  t('a newer build never offered: opens', offerAtLaunch(base), true);
  t('nothing newer: stays shut', offerAtLaunch({ ...base, newer: null }), false);
  t('the same build again: stays shut', offerAtLaunch({ ...base, offered: 5 }), false);
  t('a build newer than the one offered: opens', offerAtLaunch({ ...base, offered: 4 }), true);
  t('debug build: never', offerAtLaunch({ ...base, debug: true }), false);
  t('lite: opens once like full', offerAtLaunch({ ...base, lite: true }), true);
  t('lite with its offer off: stays shut', offerAtLaunch({ ...base, lite: true, muted: true }), false);
  t('full ignores the lite switch', offerAtLaunch({ ...base, muted: true }), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

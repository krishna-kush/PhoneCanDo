// A bench of places (src/ui/common/bench/fit.ts): whether its places share
// the row or keep a set width and scroll, and where a scrolling bench opens.
// Imports the real pure module (Node 22.18+ strips its types), so these
// cannot drift.
// Run: node test_bench_fit.js
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
  const f = await import(src('ui/common/bench/fit.ts'));

  t('width not known yet: the row', f.crowdedWidth(9, 0), null);
  t('nine places on 330dp share the row', f.crowdedWidth(9, 330), null);
  t('nine places on 288dp scroll', f.crowdedWidth(9, 288), f.CROWDED_PLACE);
  t('thirteen places on 330dp scroll', f.crowdedWidth(13, 330), f.CROWDED_PLACE);
  t('four places always fit', f.crowdedWidth(4, 200), null);
  t('the first place opens at the start', f.scrollFor(0, 40, 300), 0);
  const at10 = f.scrollFor(10, 40, 300);
  t('place 10 opens in the middle', at10 + 150, 10 * (40 + f.GAP) + f.DIVIDER + f.GAP + 20);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

// A text's letters' middle (src/ui/common/lettersMiddle.ts): where the
// drawer key meets a page title. Imports the real pure module (Node 22.18+
// strips its types), so these cannot drift.
// Run: node test_letters_middle.js (or pnpm check:vectors)
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
  const m = await import(src('ui/common/lettersMiddle.ts'));
  // A 26 dp title line, 34 tall: baseline at 26, capitals 18 tall (tops at 8).
  const line = (y, extra = {}) => ({ y, ascender: 26, capHeight: 18, height: 34, ...extra });

  t('no lines: no middle', m.lettersMiddle([]), null);
  t('one line: halfway from capital tops to baseline', m.lettersMiddle([line(0)]), 17);
  t('two lines: first capital tops to last baseline', m.lettersMiddle([line(0), line(34)]), 34);
  t("Android's baseline wins over y + ascender", m.lettersMiddle([line(0, { baseline: 28 })]), 19);
  t('one line in a 34 box: the key drops 0', m.dropToLetters([line(0)], 34), 0);
  t('letters below the box middle: the key drops to them', m.dropToLetters([line(0, { baseline: 28 })], 34), 2);
  t('letters above it: the key rises', m.dropToLetters([line(0, { baseline: 22 })], 34), -4);
  t('not measured yet: 0', [m.dropToLetters([], 34), m.dropToLetters([line(0)], 0)], [0, 0]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

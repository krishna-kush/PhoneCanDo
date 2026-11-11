// Whether a row shows in a scrolling page's window (src/ui/common/viewport/
// inView.ts): useSeenOnce asks it on each layout and scroll until a row is
// seen, so the Models page asks Hugging Face for the sizes of rows the user
// scrolls to and no others. Imports the real pure module (Node 22.18+ strips
// its types).
// Run: node test_viewport.js (or pnpm check:vectors)
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
  const { inView } = await import(src('ui/common/viewport/inView.ts'));
  const view = { top: 1000, height: 800 };
  const row = (top, height = 120) => ({ top, height });

  t('inside the window', inView(row(1200), view), true);
  t('cut by the top edge', inView(row(950), view), true);
  t('cut by the bottom edge', inView(row(1750), view), true);
  t('above the window', inView(row(800), view), false);
  t('ending at the top edge', inView(row(880), view), false);
  t('starting at the bottom edge', inView(row(1800), view), false);
  t('below the window', inView(row(2400), view), false);
  t('a row not laid out yet', inView(row(1200, 0), view), false);
  t('before the window has a height', inView(row(0), { top: 0, height: 0 }), false);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

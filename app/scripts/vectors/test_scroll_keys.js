// A swipe's bytes for the program (src/ui/terminal/keys.ts): wheel reports
// for a program that asked for mouse reports, arrow keys for an alternate
// screen without them. (A swipe over anything else scrolls the page's own
// scrollback and sends nothing.) Imports the real pure module (Node 22.18+
// strips its types), so these cannot drift.
// Run: node test_scroll_keys.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${ok ? '' : ` got=${q(got)} want=${q(want)}`}`);
}
// import() wants a URL: a bare Windows path (C:\...) is not one.
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;

(async () => {
  const { wheelSeq, arrowSeq } = await import(src('ui/terminal/keys.ts'));
  t('wheel up at the centre cell', wheelSeq(-1, 1, 49, 41), '\x1b[<64;24;20M');
  t('wheel down, one report per step', wheelSeq(1, 2, 49, 41), '\x1b[<65;24;20M\x1b[<65;24;20M');
  t('a tiny grid still reports cell 1;1', wheelSeq(-1, 1, 1, 1), '\x1b[<64;1;1M');
  t('arrow up, normal cursor keys', arrowSeq(-1, 2, false), '\x1b[A\x1b[A');
  t('arrow down, application cursor keys', arrowSeq(1, 1, true), '\x1bOB');
  t('no steps, no bytes', arrowSeq(1, 0, false), '');

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

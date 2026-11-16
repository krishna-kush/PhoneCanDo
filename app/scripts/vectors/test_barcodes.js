// The key strips' easter-egg barcodes (src/ui/common/rows/barcode/): the
// lines stay short and distinct, bars.ts is what make-barcodes.mjs writes
// for them now (fails when a line changed and bars.ts was not rebuilt:
// pnpm barcodes), and a title always picks the same line. Imports the real
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_barcodes.js (or pnpm check:vectors)
'use strict';
const fs = require('node:fs');
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
  const { BARCODE_LINES, LINE_MAX } = await import(src('ui/common/rows/barcode/lines.ts'));
  const { BARS } = await import(src('ui/common/rows/barcode/bars.ts'));
  const { lineFor } = await import(src('ui/common/rows/barcode/pick.ts'));
  const gen = await import(pathToFileURL(path.join(__dirname, '../make-barcodes.mjs')).href);

  // --- the lines ------------------------------------------------------------------
  t('every line fits', BARCODE_LINES.filter((l) => l.length > LINE_MAX), []);
  t('no line twice', new Set(BARCODE_LINES).size, BARCODE_LINES.length);
  t('capitals, digits, spaces and dashes only', BARCODE_LINES.filter((l) => !/^[A-Z0-9 -]+$/.test(l)), []);

  // --- bars.ts is current -----------------------------------------------------------
  t('bars.ts is what make-barcodes.mjs writes (pnpm barcodes)', fs.readFileSync(gen.BARS_FILE, 'utf8') === gen.barsSource(), true);
  t('one barcode per line', BARS.length, BARCODE_LINES.length);
  t('ten-module quiet zones either side', BARS.every((b) => b.path.startsWith('M10 ')), true);

  // --- which line a title picks -------------------------------------------------------
  const titles = ['Settings', 'Messages', 'Schedules', 'Used by', 'More', 'Details', '2 agents on it', 'Today', 'Recent runs'];
  t('a title always picks the same line', titles.map((x) => lineFor(x, 9)), titles.map((x) => lineFor(x, 9)));
  t('picks stay in range', titles.every((x) => { const i = lineFor(x, BARS.length); return i >= 0 && i < BARS.length; }), true);
  t('the empty title picks the first FNV bucket', lineFor('', 9), 0x811c9dc5 % 9);
  t('our titles spread over several lines', new Set(titles.map((x) => lineFor(x, BARS.length))).size >= 4, true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

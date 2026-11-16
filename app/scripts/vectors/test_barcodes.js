// The key strips' easter-egg barcodes (src/ui/common/rows/barcode/): each
// box's line stays short and its own, bars.ts is what make-barcodes.mjs
// writes for them now (fails when a line changed and bars.ts was not
// rebuilt: pnpm barcodes), its runs draw exactly the site's encoder's bars,
// and a day's box gets its day's line. Imports the real modules (Node
// 22.18+ strips their types), so these cannot drift.
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
  const { drawBars } = await import(src('ui/common/rows/barcode/draw.ts'));
  const { weekdayBarcode } = await import(src('ui/common/rows/barcode/weekdays.ts'));
  const messageDays = await import(src('ui/messages/logic/days.ts'));
  const clock = await import(src('ui/schedule/logic/clock.ts'));
  const { code128 } = await import(pathToFileURL(path.join(__dirname, '../../../web/src/lib/code128.ts')).href);
  const gen = await import(pathToFileURL(path.join(__dirname, '../make-barcodes.mjs')).href);
  const ids = Object.keys(BARCODE_LINES);
  const lines = Object.values(BARCODE_LINES);

  // --- the lines ------------------------------------------------------------------
  t('every line fits', lines.filter((l) => l.length > LINE_MAX), []);
  t('no line twice', lines.filter((l, i) => lines.indexOf(l) !== i), []);
  t('capitals, digits, spaces and dashes only', lines.filter((l) => !/^[A-Z0-9 -]+$/.test(l)), []);

  // --- bars.ts is current -----------------------------------------------------------
  t('bars.ts is what make-barcodes.mjs writes (pnpm barcodes)', fs.readFileSync(gen.BARS_FILE, 'utf8').replace(/\r\n/g, '\n') === gen.barsSource(), true);
  t('bars for every line, by its id', Object.keys(BARS), ids);
  const encoded = (line) => {
    const code = code128(line);
    return { width: code.width + 20, path: code.bars.map(({ x, w }) => `M${x + 10} 0h${w}v1h-${w}z`).join('') };
  };
  t('runs draw the encoder\'s own bars, ten-module quiet zones either side', ids.filter((id) => q(drawBars(BARS[id])) !== q(encoded(BARCODE_LINES[id]))), []);
  t('draw: a bar, a space, a bar', drawBars('121'), { width: 24, path: 'M10 0h1v1h-1zM13 0h1v1h-1z' });

  // --- a day's box ------------------------------------------------------------------
  const local = (y, mo, d, h = 12) => new Date(y, mo, d, h).getTime();
  const sun = local(2026, 10, 15);
  t('each weekday its own line', [0, 1, 2, 3, 4, 5, 6].map((i) => weekdayBarcode(local(2026, 10, 15 + i))), ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  t('messages: today, yesterday, no time, then the weekday', [sun - 3600e3, local(2026, 10, 14), 0, local(2026, 10, 11)].map((at) => messageDays.dayBarcode(at, sun)), ['messagesToday', 'messagesYesterday', 'messagesEarlier', 'wednesday']);
  t('schedules: today, tomorrow, then the weekday', [sun, local(2026, 10, 16), local(2026, 10, 20)].map((day) => clock.dayBarcode(clock.startOfDay(day), sun)), ['schedulesToday', 'schedulesTomorrow', 'friday']);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

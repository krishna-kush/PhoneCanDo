// The Mascot page (src/ui/env/agent/mascot/): the wardrobe's columns and
// rows (logic/grid.ts), Surprise me's shuffle times (logic/shuffle.ts) and
// the page's words (copy.ts). Imports the real pure modules (Node 22.18+
// strips their types), so these cannot drift.
// Run: node test_mascot_page.js (or pnpm check:vectors)
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
  const g = await import(src('ui/env/agent/mascot/logic/grid.ts'));
  const s = await import(src('ui/env/agent/mascot/logic/shuffle.ts'));
  const c = await import(src('ui/env/agent/mascot/copy.ts'));

  // --- columns: 62dp tiles, 8dp apart ---------------------------------------------
  t('a 361dp row: five, not four', g.columnsFor(361, 62, 8), 5);
  t('a 379dp row: five', g.columnsFor(379, 62, 8), 5);
  t('exactly five tiles and four gaps: five', g.columnsFor(5 * 62 + 4 * 8, 62, 8), 5);
  t('a dp short of that: four', g.columnsFor(5 * 62 + 4 * 8 - 1, 62, 8), 4);
  t('a tablet row: more', g.columnsFor(728, 62, 8), 10);
  t('narrower than one tile: still one', g.columnsFor(40, 62, 8), 1);
  t('not measured yet: one', g.columnsFor(0, 62, 8), 1);

  // --- rows -----------------------------------------------------------------------
  t('rows of five, the last one short', g.rowsOf([1, 2, 3, 4, 5, 6, 7], 5), [[1, 2, 3, 4, 5], [6, 7]]);
  t('rows that come out even', g.rowsOf([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  t('nothing: no rows', g.rowsOf([], 5), []);

  // --- the shuffle ----------------------------------------------------------------
  const times = s.shuffleTimes();
  const holds = times.shows.slice(1).map((at, i) => at - times.shows[i]);
  t('ten looks show, the pick last', times.shows.length, 10);
  t('the first shows at once', times.shows[0], 0);
  t('each held longer than the last', holds.every((h, i) => i === 0 || h >= holds[i - 1]), true);
  t('the pick is kept after it shows', times.lands > times.shows[times.shows.length - 1], true);
  t('all over in about a second', times.lands >= 800 && times.lands <= 1500, true);
  t('a shuffle of one', s.shuffleTimes(1, 100, 2), { shows: [0], lands: 100 });

  // --- words ----------------------------------------------------------------------
  t('the first design is No. 01', c.designNumber('plain'), '01');
  t('the earned one hangs last', c.designNumber('shift-lead'), c.WARDROBE_TITLE.split(' · ')[1]);
  t('the stage kicker', c.stageKicker({ design: 'coder', shape: 'tall', swap: true }), 'No. 02 · Tall');
  t('what a design wears', c.wornLine({ id: 'x', name: 'X', hat: 'tophat', neck: 'bowtie' }), 'Top hat · Bow tie');
  t('nothing worn', c.wornLine({ id: 'plain', name: 'Plain' }), 'Nothing on');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

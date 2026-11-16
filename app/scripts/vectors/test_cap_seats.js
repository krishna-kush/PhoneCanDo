// The caps' benches (Settings → Agents & models): the numbered seats
// (src/ui/settings/caps/logic/places.ts) and who sits in each
// (src/ui/settings/caps/logic/crew.ts). Imports the real pure modules
// (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_cap_seats.js (or pnpm check:vectors)
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
  const p = await import(src('ui/settings/caps/logic/places.ts'));
  const c = await import(src('ui/settings/caps/logic/crew.ts'));

  t('agents: a seat per number up to the top cap', p.capPlaces('agents', null), [1, 2, 3, 4, 5, 6, 7, 8]);
  t('models: three seats', p.capPlaces('models', 2), [1, 2, 3]);
  t('a saved cap past the offers adds seats', p.capPlaces('models', 5), [1, 2, 3, 4, 5]);
  t('no cap: every seat is in', [1, 8].map((n) => p.inCap(n, null)), [true, true]);
  t('cap 3: seats 1-3 in, 4 out', [1, 3, 4].map((n) => p.inCap(n, 3)), [true, true, false]);

  const looks = [1, 2, 3, 4].map(c.seatLook);
  t('square or tall only', looks.every((l) => l.shape === 'square' || l.shape === 'tall'), true);
  t('the same seat, the same unit', c.seatLook(5), c.seatLook(5));
  t('neighbours wear different designs', looks[0].design !== looks[1].design, true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

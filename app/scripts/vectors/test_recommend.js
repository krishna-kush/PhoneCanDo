// When the "Having fun?" card asks (src/state/logic/recommendAsk.ts): not in the
// first days or before a few good runs, only while you look at the chat,
// at most once a fortnight, and never after Share, "Don't ask again" or
// three "Not now". Imports the real pure module (Node 22.18+ strips its
// types), so these cannot drift.
// Run: node test_recommend.js (or pnpm check:vectors)
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
  const a = await import(src('state/logic/recommendAsk.ts'));
  const DAY = 24 * 60 * 60 * 1000;
  const t0 = 1_000_000;

  // Runs that finish while looking, from a fresh start at t0.
  const runs = (s, n, at, looking = true) => {
    let asks = 0;
    for (let i = 0; i < n; i++) {
      const r = a.runFinished(s, at, looking);
      s = r.state;
      if (r.ask) asks++;
    }
    return { s, asks };
  };

  // --- not yet ---------------------------------------------------------------
  const fresh = a.started(a.FRESH, t0);
  t('the clock starts once', a.started(fresh, t0 + DAY).since, t0);
  t('a few good runs are not enough', runs(fresh, a.MIN_RUNS - 1, t0 + 3 * DAY).asks, 0);
  t('enough runs in the first days: no ask', runs(fresh, a.MIN_RUNS, t0 + DAY).asks, 0);
  t('no clock yet: the first run starts it', a.runFinished(a.FRESH, t0, true).state.since, t0);

  // --- asking ----------------------------------------------------------------
  const ready = runs(fresh, a.MIN_RUNS - 1, t0 + DAY).s;
  const first = a.runFinished(ready, t0 + 3 * DAY, true);
  t('the fifth run after two days asks', first.ask, true);
  t('asking stamps the time', first.state.lastAskedAt, t0 + 3 * DAY);
  t('runs are counted up to the minimum only', first.state.runs, a.MIN_RUNS);
  t('not looking: counted, no ask', a.runFinished(ready, t0 + 3 * DAY, false), {
    state: { ...ready, runs: a.MIN_RUNS },
    ask: false,
  });

  // --- how often -------------------------------------------------------------
  const asked = first.state;
  t('the next run the same week does not ask', a.runFinished(asked, t0 + 5 * DAY, true).ask, false);
  t('a fortnight later it asks again', a.runFinished(asked, t0 + 17 * DAY, true).ask, true);

  // --- answers ---------------------------------------------------------------
  const later = t0 + 100 * DAY;
  t('shared: never again', a.runFinished(a.answered(asked, 'share'), later, true).ask, false);
  t("don't ask again: never again", a.runFinished(a.answered(asked, 'never'), later, true).ask, false);
  let s = asked;
  for (let i = 0; i < a.MAX_NOT_NOW - 1; i++) s = a.answered(s, 'notNow');
  t('two "Not now": it still asks later', a.runFinished(s, later, true).ask, true);
  t('three "Not now": never again', a.runFinished(a.answered(s, 'notNow'), later, true).ask, false);

  // --- stored state ----------------------------------------------------------
  t('nothing stored is fresh', a.parseAsk(null), a.FRESH);
  t('junk is fresh', a.parseAsk('{nope'), a.FRESH);
  t('a stored state reads back', a.parseAsk(JSON.stringify(asked)), asked);
  t('odd fields are cleaned', a.parseAsk('{"since":"x","runs":99,"notNow":-2,"done":1}'), {
    since: null,
    runs: a.MIN_RUNS,
    lastAskedAt: null,
    notNow: 0,
    done: false,
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

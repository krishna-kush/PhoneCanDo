// When the "Having fun?" card asks (src/state/logic/recommendAsk.ts): not in the
// first days or before a few good runs, only while you look at the chat,
// at most once a fortnight, and never after Share, "Don't ask again" or
// three "Not now". Then share links (src/state/logic/share/): codes, links
// and reading one back, when opening through one counts as an install, the
// kept list and joining it with the account's; the server's answers
// (engine/share/wire.ts, engine/account/wire.ts); and the Refer page's
// funnel (ui/recommend/logic/funnel.ts). Imports the real pure modules
// (Node 22.18+ strips their types), so these cannot drift.
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

  // --- share codes -----------------------------------------------------------
  const c = await import(src('state/logic/share/code.ts'));
  t('32 letters nobody misreads', [c.CODE_ALPHABET.length, /[lo01]/.test(c.CODE_ALPHABET)], [32, false]);
  const code = c.codeFromBytes([0, 1, 2, 31, 32, 255, 100, 7, 9]);
  t('a code from bytes: each byte\'s low 5 bits', code, 'abc9a9eh');
  t('a made code is a code', c.isShareCode(code), true);
  t('too few bytes: no code', c.codeFromBytes([1, 2, 3]), null);
  t('not codes', ['abcdefgl', 'ABCDEFGH', 'abcdefg', 'abcdefghj', 'abcdef0h', 42, null].map(c.isShareCode), [
    false, false, false, false, false, false, false,
  ]);

  // --- links -----------------------------------------------------------------
  const l = await import(src('state/logic/share/link.ts'));
  t('tracked link', l.shareLinkFor('k7q2m9xa'), 'https://phonecando.app/i/k7q2m9xa');
  t('untracked link', l.shareLinkFor(null), 'https://phonecando.app');
  t('read back', [
    l.codeFromUrl('https://phonecando.app/i/k7q2m9xa'),
    l.codeFromUrl('https://phonecando.app/i/k7q2m9xa/'),
    l.codeFromUrl('https://phonecando.app/i/k7q2m9xa?utm=x'),
    l.codeFromUrl('https://PhoneCanDo.app/i/k7q2m9xa#top'),
  ], ['k7q2m9xa', 'k7q2m9xa', 'k7q2m9xa', 'k7q2m9xa']);
  t('other urls read nothing', [
    l.codeFromUrl('http://phonecando.app/i/k7q2m9xa'),
    l.codeFromUrl('https://evil.app/i/k7q2m9xa'),
    l.codeFromUrl('https://phonecando.app.evil.com/i/k7q2m9xa'),
    l.codeFromUrl('https://phonecando.app/i/k7q2m9xa/more'),
    l.codeFromUrl('https://phonecando.app/i/K7Q2M9XA'),
    l.codeFromUrl('https://phonecando.app/'),
    l.codeFromUrl(null),
  ], [null, null, null, null, null, null, null]);

  const now = 50 * DAY;
  const check = (o) => l.countsAsInstall({ code: 'k7q2m9xa', own: [], firstInstallAt: now - DAY, now, counted: false, ...o });
  t('a fresh install through a friend\'s link counts', check({}), true);
  t('a week in still counts', check({ firstInstallAt: now - 7 * DAY }), true);
  t('older installs do not', check({ firstInstallAt: now - 8 * DAY }), false);
  t('our own link does not', check({ own: ['k7q2m9xa'] }), false);
  t('only once', check({ counted: true }), false);
  t('no install time: not counted', check({ firstInstallAt: null }), false);
  t('a clock before the install: not counted', check({ firstInstallAt: now + DAY }), false);

  // --- the kept list ---------------------------------------------------------
  const k = await import(src('state/logic/share/list.ts'));
  t('nothing kept is empty', k.parseKept(null), k.EMPTY);
  t('junk is empty', k.parseKept('{nope'), k.EMPTY);
  const kept = k.parseKept(JSON.stringify({
    links: [
      { code: 'aaaaaaaa', at: 1, app: 'Chat' },
      { code: null, at: 3, app: null },
      { code: 'bbbbbbbb', at: 2, app: '' },
      { code: 'bad', at: 4, app: 'x' },
      { at: 'x' },
    ],
    installCounted: true,
  }));
  t('kept reads back newest first, junk dropped', kept, {
    links: [
      { code: null, at: 3, app: null },
      { code: 'bbbbbbbb', at: 2, app: null },
      { code: 'aaaaaaaa', at: 1, app: 'Chat' },
    ],
    installCounted: true,
  });
  t('a code is added once', k.addLink(kept.links, { code: 'aaaaaaaa', at: 9, app: null }), kept.links);
  t('a new link goes first', k.addLink(kept.links, { code: 'cccccccc', at: 9, app: 'Mail' })[0], { code: 'cccccccc', at: 9, app: 'Mail' });
  t('tracked codes', k.trackedCodes(kept.links), ['bbbbbbbb', 'aaaaaaaa']);
  t('what the account gets', k.forAccount(kept.links), [{ code: 'bbbbbbbb', created: 2 }, { code: 'aaaaaaaa', created: 1 }]);
  t('joined with the account', k.mergeAccount(kept.links, [
    { code: 'aaaaaaaa', created: 0 },
    { code: 'dddddddd', created: 5 },
    { code: 'nope', created: 6 },
  ]), [
    { code: 'dddddddd', at: 5, app: null },
    { code: null, at: 3, app: null },
    { code: 'bbbbbbbb', at: 2, app: null },
    { code: 'aaaaaaaa', at: 0, app: 'Chat' },
  ]);
  const many = Array.from({ length: k.MAX_LINKS + 5 }, (_, i) => ({ code: null, at: i, app: null }));
  t('at most MAX_LINKS kept', k.parseKept(JSON.stringify({ links: many })).links.length, k.MAX_LINKS);

  // --- the server's answers --------------------------------------------------
  const sw = await import(src('engine/share/wire.ts'));
  t('stats read', sw.parseStats({ links: [
    { code: 'aaaaaaaa', opened: 3, downloaded: 1, installed: 1, using: 0, lastDay: '2026-11-12' },
    { code: 'bbbbbbbb', opened: -1, downloaded: 'x' },
    { nope: 1 },
  ] }), {
    aaaaaaaa: { code: 'aaaaaaaa', opened: 3, downloaded: 1, installed: 1, using: 0, lastDay: '2026-11-12' },
    bbbbbbbb: { code: 'bbbbbbbb', opened: 0, downloaded: 0, installed: 0, using: 0, lastDay: null },
  });
  t('no list: no stats', sw.parseStats({ error: 'internal' }), null);
  const aw = await import(src('engine/account/wire.ts'));
  t('account read', [aw.parseAccount('{"email":"a@b.c","createdAt":5}'), aw.parseAccount({ email: 'a@b.c' }), aw.parseAccount('nope')], [
    { email: 'a@b.c', createdAt: 5 },
    null,
    null,
  ]);
  t('account links read', aw.parseAccountLinks({ links: [{ code: 'aaaaaaaa', created: 1 }, { code: 2 }] }), [{ code: 'aaaaaaaa', created: 1 }]);
  t('error code', [aw.errorCode({ error: 'bad_token' }), aw.errorCode({}), aw.errorCode(null)], ['bad_token', null, null]);

  // --- the Refer page's funnel -----------------------------------------------
  const f = await import(src('ui/recommend/logic/funnel.ts'));
  const stats = sw.parseStats({ links: [
    { code: 'aaaaaaaa', opened: 3, downloaded: 2, installed: 1, using: 1 },
    { code: 'bbbbbbbb', opened: 1 },
  ] });
  const totals = f.funnel(kept.links, stats);
  t('funnel totals', totals, { sent: 3, opened: 4, downloaded: 2, installed: 1, using: 1 });
  t('funnel steps in order', f.funnelSteps(totals).map((x) => [x.label, x.count]), [
    ['Sent', 3], ['Opened', 4], ['Downloaded', 2], ['Installed', 1], ['Using it', 1],
  ]);
  t('link lines', [
    f.linkLine(kept.links[0], undefined),
    f.linkLine(kept.links[1], undefined),
    f.linkLine(kept.links[1], stats.bbbbbbbb),
    f.linkLine(kept.links[2], stats.aaaaaaaa),
    f.linkLine(kept.links[2], { ...stats.aaaaaaaa, opened: 0, downloaded: 0, installed: 0, using: 0 }),
  ], [
    'Not tracked: usage stats were off',
    'Not counted yet',
    '1 opened',
    '3 opened · 2 downloaded · 1 installed · 1 using it',
    'No clicks yet',
  ]);
  t('link titles', [f.linkTitle(kept.links[2]), f.linkTitle(kept.links[1])], ['Via Chat', 'Shared']);
  const noon = new Date(2026, 10, 12, 12).getTime();
  t('sent labels', [
    f.sentLabel(noon - 60_000, noon),
    f.sentLabel(new Date(2026, 10, 11, 23).getTime(), noon),
    f.sentLabel(new Date(2026, 9, 3, 9).getTime(), noon),
    f.sentLabel(new Date(2025, 0, 2, 9).getTime(), noon),
  ], ['today', 'yesterday', '3 Oct', '2 Jan 2025']);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

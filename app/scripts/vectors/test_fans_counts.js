// The fans count made at build time (scripts/make-fans.mjs): each kind's
// repo from its manifest, the search queries, the counts kept when GitHub
// doesn't answer, and counts.ts reading back as it was written.
// Imports the real script (Node 22.18+), so these cannot drift.
// Run: node test_fans_counts.js (or pnpm check:vectors)
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

(async () => {
  const m = await import(pathToFileURL(path.join(__dirname, '../make-fans.mjs')).href);

  // --- repos ----------------------------------------------------------------------
  t(
    'a github.com repo, with or without its slash or .git',
    ['https://github.com/openai/codex', 'https://github.com/a-b/c.d/', 'https://github.com/x/y.git'].map(m.repoOf),
    ['openai/codex', 'a-b/c.d', 'x/y'],
  );
  t(
    'anything else: none',
    ['https://cursor.com/cli', 'https://github.com/openai', 'https://github.com/a/b/tree/main', undefined].map(m.repoOf),
    [null, null, null, null],
  );
  const repos = m.kindRepos();
  t('every bundled kind, the default one first', Object.keys(repos)[0], 'opencode');
  t("a closed kind (no github.com source): no repo", repos['cursor-cli'], null);

  // --- queries --------------------------------------------------------------------
  t('a few repos: one query', m.queries(['a/b', 'c/d']), ['repo:a/b repo:c/d']);
  const many = Array.from({ length: 40 }, (_, i) => `owner-${i}/repository-${i}`);
  const qs = m.queries(many);
  t('many: split, each short enough', [qs.length > 1, qs.every((x) => x.length <= 400)], [true, true]);
  t('…asking for every one, once', qs.join(' ').split(' ').length, many.length);

  // --- merge ----------------------------------------------------------------------
  const kinds = { a: 'Org/A', b: 'org/b', c: null, d: 'org/d' };
  t(
    "fresh counts by repo in GitHub's spelling; the rest kept; no repo: null",
    m.merge(kinds, { 'org/a': 10, 'org/b': 20 }, { a: 1, b: 2, d: 4 }),
    { a: 10, b: 20, c: null, d: 4 },
  );
  t('GitHub silent: everything kept', m.merge(kinds, {}, { a: 1, b: 2, d: 4 }), { a: 1, b: 2, c: null, d: 4 });
  t('a new kind never counted: left out until it is', m.merge(kinds, {}, {}), { c: null });

  // --- freshness ------------------------------------------------------------------
  const at = '2026-11-17T06:00:00Z';
  const hour = 3600_000;
  t('young counts for the same kinds: kept', m.fresh(at, Date.parse(at) + hour, { a: 1 }, { a: 'x/y' }), true);
  t(`older than ${m.STALE_HOURS} hours: counted again`, m.fresh(at, Date.parse(at) + 7 * hour, { a: 1 }, { a: 'x/y' }), false);
  t('a kind added since: counted again', m.fresh(at, Date.parse(at) + hour, { a: 1 }, { a: 'x/y', b: 'x/z' }), false);
  t('never counted: counted', m.fresh(null, Date.now(), {}, {}), false);

  // --- counts.ts ------------------------------------------------------------------
  const now = m.readCounts();
  const text = require('node:fs').readFileSync(m.COUNTS_FILE, 'utf8');
  t('counts.ts reads back exactly as it was written', m.countsSource(now.at, now.counts), text);
  t('…no kind in it that agents/ has dropped', Object.keys(now.counts).every((id) => id in repos), true);
  t(
    '…a kind with no repo counts as null',
    Object.entries(repos).every(([id, r]) => r != null || now.counts[id] === null),
    true,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

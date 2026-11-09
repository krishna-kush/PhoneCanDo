// A running install's live lines: the retry and activity a guest script's
// events carry, folded into the run (src/state/flows/logic/installRun.ts),
// and the words under its bar (src/ui/env/logic/installText.ts, format.ts):
// "Downloading 120 MB · 1.2 MB/s", "Still working · 2 min 10 s",
// "No network · 2 min 10 s", "Network hiccup — trying again (2 of 3)". Imports the real pure modules
// (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_install_activity.js (or pnpm check:vectors)
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
  // --- the fold -----------------------------------------------------------
  const { startRun, applyInstallEvent, retryOf, activityOf } = await import(src('state/flows/logic/installRun.ts'));
  const fold = (run, events) => events.reduce(applyInstallEvent, run);
  const script = fold(startRun('install'), [
    { type: 'stage', stage: 'plan' },
    { type: 'plan', phases: ['runtime:node', 'packages', 'install', 'verify'] },
    { type: 'stage', stage: 'script' },
  ]);
  t('a run starts with no retry or activity', [script.retry, script.activity], [null, null]);

  const ev = (fields) => ({ type: 'progress', phase: 'install', tail: [], retry: null, elapsedSec: 0, downloadedBytes: 0, rateBytesPerSec: 0, ...fields });
  const busy = fold(script, [ev({ elapsedSec: 130, downloadedBytes: 120_000_000, rateBytesPerSec: 1_200_000 })]);
  t('activity lands', busy.activity, { elapsedSec: 130, downloadedBytes: 120_000_000, rateBytesPerSec: 1_200_000, online: null });
  const retrying = fold(busy, [ev({ retry: { attempt: 2, max: 3 }, elapsedSec: 131, downloadedBytes: 121_000_000, rateBytesPerSec: 1_200_000 })]);
  t('a retry lands', retrying.retry, { attempt: 2, max: 3 });
  t('an event without a retry field keeps it', fold(retrying, [{ type: 'progress', elapsedSec: 132 }]).retry, { attempt: 2, max: 3 });
  t('a null retry ends it', fold(retrying, [ev({ elapsedSec: 133 })]).retry, null);
  t('an event without elapsedSec keeps the activity', fold(busy, [{ type: 'progress', phase: 'install' }]).activity, busy.activity);
  const blind = fold(script, [ev({ elapsedSec: 7, downloadedBytes: null, rateBytesPerSec: null })]);
  t('an app Android cannot count has time only', blind.activity, { elapsedSec: 7, downloadedBytes: null, rateBytesPerSec: null, online: null });
  const offline = fold(script, [ev({ elapsedSec: 130, downloadedBytes: 0, rateBytesPerSec: 0, online: false })]);
  t('offline lands', offline.activity.online, false);

  t('retry ok', retryOf({ attempt: 1, max: 3 }), { attempt: 1, max: 3 });
  t('retry past its max', retryOf({ attempt: 4, max: 3 }), null);
  t('retry zero', retryOf({ attempt: 0, max: 3 }), null);
  t('retry not whole', retryOf({ attempt: 1.5, max: 3 }), null);
  t('retry text', retryOf('2/3'), null);
  t('retry null', retryOf(null), null);
  t('activity without time', activityOf({ downloadedBytes: 5 }), null);
  t('activity drops bad counts', activityOf({ elapsedSec: 3, downloadedBytes: -1, rateBytesPerSec: 'x' }), {
    elapsedSec: 3, downloadedBytes: null, rateBytesPerSec: null, online: null,
  });

  // --- the words ----------------------------------------------------------
  const { formatDuration, formatRate } = await import(src('ui/env/logic/format.ts'));
  t('seconds', formatDuration(45), '45 s');
  t('no time yet', formatDuration(0), '0 s');
  t('minutes and seconds', formatDuration(130), '2 min 10 s');
  t('whole minutes', formatDuration(120), '2 min');
  t('hours drop seconds', formatDuration(3_930), '1 h 5 min');
  t('whole hours', formatDuration(7_200), '2 h');
  t('a bad duration', formatDuration(-1), '—');
  t('rate', formatRate(1_234_567), '1.2 MB/s');
  t('slow rate', formatRate(850), '850 B/s');

  const { activityLine, retryLine, installActivityLines, DOWNLOADING_MIN_RATE } = await import(src('ui/env/logic/installText.ts'));
  t('downloading', activityLine({ elapsedSec: 130, downloadedBytes: 120_000_000, rateBytesPerSec: 1_200_000 }), 'Downloading 120 MB · 1.2 MB/s');
  t('at the threshold it downloads', activityLine({ elapsedSec: 5, downloadedBytes: 100_000, rateBytesPerSec: DOWNLOADING_MIN_RATE }),
    'Downloading 100 KB · 20 KB/s');
  t('below the threshold it works', activityLine({ elapsedSec: 130, downloadedBytes: 120_000_000, rateBytesPerSec: DOWNLOADING_MIN_RATE - 1 }),
    'Still working · 2 min 10 s');
  t('no counter, still working', activityLine({ elapsedSec: 130, downloadedBytes: null, rateBytesPerSec: null }), 'Still working · 2 min 10 s');
  t('offline says so', activityLine({ elapsedSec: 130, downloadedBytes: 0, rateBytesPerSec: 0, online: false }), 'No network · 2 min 10 s');
  t('online is the usual line', activityLine({ elapsedSec: 130, downloadedBytes: null, rateBytesPerSec: null, online: true }), 'Still working · 2 min 10 s');
  t('offline under a retry', installActivityLines(fold(offline, [ev({ retry: { attempt: 2, max: 3 }, elapsedSec: 131, online: false })])),
    ['Network hiccup — trying again (2 of 3)', 'No network · 2 min 11 s']);
  t('retry words: the attempt about to start', retryLine({ attempt: 2, max: 3 }), 'Network hiccup — trying again (2 of 3)');
  t('lines while retrying a download', installActivityLines(retrying),
    ['Network hiccup — trying again (2 of 3)', 'Downloading 121 MB · 1.2 MB/s']);
  t('lines while quiet', installActivityLines(blind), ['Still working · 7 s']);
  t('no lines before the first event', installActivityLines(script), []);
  t('no lines during our version check', installActivityLines(fold(busy, [{ type: 'stage', stage: 'verify' }])), []);
  t('no lines once failed', installActivityLines(fold(retrying, [{ type: 'failed', failure: { code: 'command_failed', message: '' } }])), []);

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

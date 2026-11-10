// An install's bar (src/state/flows/logic/installProgress.ts, kept by the
// run fold in installRun.ts): it starts a little ahead, the plan's phases
// share it by weight, each phase moves with its seconds and bytes without
// reaching the next phase's start, it holds still while the phone is
// offline and goes on from there, it never goes back, and it is full only
// once the run ended well. Imports the real pure modules (Node 22.18+ strips
// their types), so these cannot drift.
// Run: node test_install_progress.js (or pnpm check:vectors)
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
const flows = (p) => src('state/flows/logic', p);
const MB = 1_000_000;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const rising = (xs) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
const neverDown = (xs) => xs.every((x, i) => i === 0 || x >= xs[i - 1]);

(async () => {
  const { START, SCRIPT_END, CHECK_AT, phaseSpans, phaseEase, progressNow } = await import(flows('installProgress.ts'));
  const { startRun, applyInstallEvent, offlineSince } = await import(flows('installRun.ts'));

  // --- the layout ---------------------------------------------------------
  t('it starts a little ahead, visibly', START > 0 && START <= 0.05, true);
  t('the stages are in order', 0 < START && START < SCRIPT_END && SCRIPT_END < CHECK_AT && CHECK_AT < 1, true);
  const phases = ['runtime:node', 'packages', 'install', 'verify'];
  const spans = phaseSpans(phases);
  t('one span per phase, in order', spans.map((s) => s.phase), phases);
  t('the first phase starts at START', spans[0].from, START);
  t('the last phase ends at SCRIPT_END', near(spans[3].to, SCRIPT_END), true);
  t('spans meet end to start', spans.slice(1).every((s, i) => s.from === spans[i].to), true);
  const width = (s) => s.to - s.from;
  const [runtime, packages, install, verify] = spans;
  t('the agent install is the biggest share', width(install) > width(packages) && width(install) > width(runtime), true);
  t('verify is a sliver', width(verify) < width(runtime) / 5, true);
  const two = phaseSpans(['runtime:node', 'runtime:python', 'install', 'verify']);
  t('each runtime gets its own equal share', near(width(two[0]), width(two[1])), true);
  const update = phaseSpans(['runtime:node', 'update', 'verify']);
  t('update weighs like install', near(width(update[1]) / width(update[0]), width(install) / width(runtime)), true);
  const other = phaseSpans(['post_install']);
  t('an unknown phase still gets a share', [other[0].from, near(other[0].to, SCRIPT_END)], [START, true]);
  t('no phases, no spans', phaseSpans([]), []);

  // --- within a phase -----------------------------------------------------
  t('a phase starts empty', phaseEase('install', 0, 0), 0);
  const bySec = [1, 10, 60, 300, 1200, 3600].map((s) => phaseEase('install', s, null));
  t('time alone moves it, always', rising(bySec), true);
  t('time alone never fills it', bySec.every((x) => x < 1), true);
  const byBytes = [1, 10, 50, 200, 1000].map((mb) => phaseEase('install', 5, mb * MB));
  t('bytes move it', rising(byBytes), true);
  t('bytes never fill it', phaseEase('install', 1e6, 1e13) < 1, true);
  t('bytes Android cannot count read as none', phaseEase('install', 30, null), phaseEase('install', 30, 0));
  t('the version check counts no bytes', phaseEase('verify', 2, 500 * MB), phaseEase('verify', 2, null));
  t('runtimes share one profile', phaseEase('runtime:python', 20, 10 * MB), phaseEase('runtime:node', 20, 10 * MB));
  t('a bad reading is no work', phaseEase('install', -5, -1), 0);

  // --- a whole run, as native reports it ----------------------------------
  // Qwen Code on a fresh machine: Node.js (27 MB at 5 MB/s, then unpacking),
  // the packages, npm (60 MB over two minutes, then quiet linking), verify.
  let run = startRun('install');
  const seen = [run.fraction];
  const apply = (e) => {
    run = applyInstallEvent(run, e);
    seen.push(run.fraction);
    return run.fraction;
  };
  const tick = (phase, sec, bytes, extra = {}) =>
    apply({ type: 'progress', phase, tail: [], retry: null, elapsedSec: sec, downloadedBytes: bytes, rateBytesPerSec: 0, ...extra });

  t('a fresh run shows START', run.fraction, START);
  apply({ type: 'stage', stage: 'plan' });
  apply({ type: 'plan', phases });
  apply({ type: 'stage', stage: 'script' });
  t('still START until the script says where it is', run.fraction, START);
  tick(null, 0, 0);
  t('the first event before a phase', run.fraction, START);

  const node = [];
  let sec = 0;
  let bytes = 0;
  for (; sec <= 6; sec++, bytes = Math.min(27 * MB, bytes + 5 * MB)) node.push(tick('runtime:node', sec, bytes));
  t('Node.js starts at its share', node[0], runtime.from);
  t('the bar moves every second of the download', rising(node), true);
  const unpack = [];
  for (; sec <= 50; sec++) unpack.push(tick('runtime:node', sec, bytes));
  t('it keeps moving while unpacking (no bytes)', rising(unpack), true);
  t('the download moved it more than the same time unpacking', node[6] - node[0] > unpack[6] - unpack[0], true);
  t('Node.js never reaches the packages', run.fraction < packages.from, true);

  // The packages' first event: their start is the reading before it.
  const before = run.activity;
  tick('packages', sec++, bytes);
  t('a new phase counts from the reading before it', run.phaseStart, { elapsedSec: before.elapsedSec, downloadedBytes: before.downloadedBytes, offlineSec: 0 });
  t('packages start at their share', run.fraction >= packages.from && run.fraction < install.from, true);
  for (let i = 0; i < 40; i++, sec++) tick('packages', sec, (bytes += 300_000));

  tick('install', sec++, bytes);
  t('npm starts at its share', run.fraction >= install.from, true);
  const npm = [];
  for (let i = 0; i < 120; i++, sec++) npm.push(tick('install', sec, (bytes += 500_000)));
  t('npm moves with its bytes', rising(npm), true);
  // A slow phone: npm links for twenty more minutes and downloads nothing.
  const linking = [];
  for (let i = 0; i < 1200; i++, sec++) linking.push(tick('install', sec, bytes));
  t('a long quiet phase still creeps', rising(linking), true);
  t('it never reaches verify early', run.fraction < verify.from, true);
  t('even 20 minutes in, it has room left', verify.from - run.fraction > 1e-4, true);

  // A step failed and runs again: the bar does not start the phase over.
  const atRetry = run.fraction;
  tick('install', sec++, bytes, { retry: { attempt: 2, max: 3 } });
  t('a retry keeps the bar moving forward', run.fraction > atRetry, true);

  tick('verify', sec++, bytes);
  t('verify starts at its share', run.fraction >= verify.from, true);
  tick('verify', sec++, bytes);
  t('the script never reaches SCRIPT_END', run.fraction < SCRIPT_END, true);
  apply({ type: 'stage', stage: 'verify' });
  t('our version check', run.fraction, CHECK_AT);
  t('never full before it ended', seen.every((f) => f < 1), true);
  apply({ type: 'done', version: '0.27.0' });
  t('full once done', run.fraction, 1);
  t('never backwards, start to end', neverDown(seen), true);

  // --- readings that would go back ----------------------------------------
  const scripted = (ps) =>
    [{ type: 'stage', stage: 'plan' }, { type: 'plan', phases: ps }, { type: 'stage', stage: 'script' }].reduce(applyInstallEvent, startRun('install'));
  const ev = (phase, s, b) => ({ type: 'progress', phase, elapsedSec: s, downloadedBytes: b, rateBytesPerSec: 0 });
  const counted = [ev('install', 0, 0), ev('install', 10, 40 * MB)].reduce(applyInstallEvent, scripted(['install']));
  const lost = applyInstallEvent(counted, ev('install', 11, null));
  t('a counter that stops counting does not pull it back', lost.fraction, counted.fraction);
  const blind = [ev('install', 0, null), ev('install', 30, null), ev('install', 60, null)].reduce(
    (acc, e) => [...acc, applyInstallEvent(acc[acc.length - 1], e)],
    [scripted(['install'])],
  );
  t('where Android cannot count, time moves it', rising(blind.slice(1).map((r) => r.fraction)), true);
  const odd = applyInstallEvent(counted, ev('post_install', 12, 40 * MB));
  t('a phase the plan does not list holds the bar', odd.fraction, counted.fraction);
  const failed = applyInstallEvent(counted, { type: 'failed', failure: { code: 'command_failed', message: '' } });
  t('a failed run keeps where it was', failed.fraction, counted.fraction);

  // An update whose runtime is in place: skipped in a second, the bar jumps ahead.
  const up = phaseSpans(['runtime:node', 'update', 'verify']);
  const quick = [ev('runtime:node', 0, 0), ev('update', 1, 0)].reduce(applyInstallEvent, scripted(['runtime:node', 'update', 'verify']));
  t('a skipped runtime hands over at once', quick.fraction >= up[1].from, true);

  // --- offline ------------------------------------------------------------
  // Seconds while the phone says it is offline do not count: the bar holds
  // still, and online again it goes on from the same place, as if the
  // offline time had not been.
  const net = (phase, s, b, online) => ({ type: 'progress', phase, elapsedSec: s, downloadedBytes: b, rateBytesPerSec: 0, online });
  const fold = (r, es) => es.reduce(applyInstallEvent, r);
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const online10 = fold(scripted(['install']), range(0, 10).map((s) => net('install', s, 10 * MB, true)));
  const away = range(11, 70).reduce((acc, s) => [...acc, applyInstallEvent(acc[acc.length - 1], net('install', s, 10 * MB, false))], [online10]);
  t('offline, the bar holds still', away.every((r) => r.fraction === online10.fraction), true);
  const awayEnd = away[away.length - 1];
  t('the run keeps the offline seconds', awayEnd.offlineSec, 60);
  t('the reading still says offline', awayEnd.activity.online, false);
  const back = fold(awayEnd, range(71, 80).map((s) => net('install', s, 10 * MB, true)));
  const never = fold(online10, range(11, 20).map((s) => net('install', s, 10 * MB, true)));
  t('online again it goes on from the same place', back.fraction, never.fraction);
  t('and moves again', back.fraction > awayEnd.fraction, true);
  const unknown = fold(online10, range(11, 20).map((s) => net('install', s, 10 * MB, null)));
  t('a phone that will not say counts as online', [unknown.offlineSec, unknown.fraction], [0, never.fraction]);
  const firstOff = fold(scripted(['install']), [net('install', 5, 0, false)]);
  t('offline from the first reading counts from the start', [firstOff.offlineSec, firstOff.fraction], [5, START]);

  // Offline in one phase is not taken off the next.
  const pair = ['packages', 'install'];
  const twoSpans = phaseSpans(pair);
  const before2 = fold(scripted(pair), [...range(0, 10).map((s) => net('packages', s, 0, true)), ...range(11, 40).map((s) => net('packages', s, 0, false))]);
  const into = fold(before2, range(41, 51).map((s) => net('install', s, 0, true)));
  t('the next phase starts with the offline time so far', into.phaseStart, { elapsedSec: 40, downloadedBytes: 0, offlineSec: 30 });
  t('and counts only its own seconds', near(into.fraction, twoSpans[1].from + (twoSpans[1].to - twoSpans[1].from) * phaseEase('install', 11, 0)), true);
  const offAtStart = fold(before2, [net('install', 41, 0, false), net('install', 42, 0, false)]);
  t('a phase that starts offline holds at its start', offAtStart.fraction, Math.max(before2.fraction, twoSpans[1].from));

  t('offline since: the time up to an offline reading', offlineSince({ elapsedSec: 10, online: true }, { elapsedSec: 12.5, online: false }), 2.5);
  t('offline since: none when online or unknown', [offlineSince({ elapsedSec: 10 }, { elapsedSec: 12, online: true }), offlineSince({ elapsedSec: 10 }, { elapsedSec: 12, online: null }), offlineSince({ elapsedSec: 10 }, null)], [0, 0, 0]);
  t('offline since: a clock that went back is none', offlineSince({ elapsedSec: 10 }, { elapsedSec: 4, online: false }), 0);

  // progressNow on its own, for the stages.
  const base = { status: 'running', phases, phase: null, activity: null, phaseStart: null, offlineSec: 0 };
  t('machine', progressNow({ ...base, stage: 'machine' }), START);
  t('plan', progressNow({ ...base, stage: 'plan' }), START);
  t('verify stage', progressNow({ ...base, stage: 'verify' }), CHECK_AT);
  t('done', progressNow({ ...base, stage: 'verify', status: 'done' }), 1);

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

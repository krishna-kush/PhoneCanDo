// The in-app update's two steps (src/state/logic/update/steps.ts: where an
// update rests, what runs with the box hidden, its pace), the box's
// progress line (src/ui/update/copy.ts), a download's tracking stops
// (src/ui/common/route/copy.ts) and what the install stops
// (src/ui/update/logic/stops.ts). Imports the real pure
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_update_steps.js (or pnpm check:vectors)
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
  const s = await import(src('state/logic/update/steps.ts'));
  const c = await import(src('ui/update/copy.ts'));
  const k = await import(src('ui/update/logic/stops.ts'));
  const r = await import(src('ui/common/route/copy.ts'));
  const rel = await import(src('ui/update/logic/release.ts'));

  // --- where an update rests ----------------------------------------------------
  t('nothing newer: nothing', s.restingStep(false, 'done'), null);
  t('newer, no download: the offer', s.restingStep(true, null), 'offer');
  t('newer and on the phone: waits for Install', s.restingStep(true, 'done'), 'downloaded');
  t('a download the runner carries on: still downloading', ['download', 'verify', 'retry', 'offline'].map((d) => s.restingStep(true, d)), [
    'downloading', 'downloading', 'downloading', 'downloading',
  ]);
  t('a failed or stopped download: the offer again', [s.restingStep(true, 'failed'), s.restingStep(true, 'stopped')], ['offer', 'offer']);
  t('still under way', ['download', 'verify', 'retry', 'offline', 'done', 'failed', 'stopped', null].map(s.stillDownloading), [
    true, true, true, true, false, false, false, false,
  ]);
  t('only a download runs hidden', ['offer', 'downloading', 'downloaded', 'stopping', null].map(s.runsHidden), [false, true, false, false, false]);
  t('the box holds while agents stop or the installer is up', ['downloaded', 'permission', 'stopping', 'installer', 'cancelled'].map(s.holdsBox), [
    false, false, true, true, false,
  ]);

  // --- the download's share and pace ----------------------------------------------
  t('share', [s.fractionOf(50, 200), s.fractionOf(300, 200), s.fractionOf(5, 0)], [0.25, 1, null]);
  t('no pace before 2 s', s.secondsLeft(50, 100, 0, 1500), null);
  t('no pace before 1%', s.secondsLeft(5, 1000, 0, 10_000), null);
  t('no pace without a size or a start', [s.secondsLeft(50, 0, 0, 10_000), s.secondsLeft(50, 100, null, 10_000)], [null, null]);
  t('pace so far: half in 10 s, 10 s to go', s.secondsLeft(50, 100, 0, 10_000), 10);

  // --- the box's lines -------------------------------------------------------------
  t('time left', [null, 4, 30, 89, 300].map(c.leftLine), [null, 'a few seconds left', 'under a minute left', 'about 1 min left', 'about 5 min left']);
  t('progress line', c.progressLine(65_000_000, 152_000_000, 61), '42% · 65 MB of 152 MB · about 1 min left');
  t('progress line before a pace', c.progressLine(1_000_000, 152_000_000, null), '0% · 1 MB of 152 MB');
  t('while the runner waits', [
    c.progressLine(65_000_000, 152_000_000, 61, 'offline'),
    c.progressLine(65_000_000, 152_000_000, 61, 'retry'),
    c.progressLine(65_000_000, 152_000_000, null, 'verify'),
  ], ['Waiting for a network · 65 MB kept', 'Trying again in a moment · 65 MB kept', 'Checking what an earlier try left…']);
  t('progress line without a size', [c.progressLine(0, 0, null), c.progressLine(3_000_000, 0, null)], ['Starting…', '3 MB so far']);
  t('tracking stops', [null, 0, 0.24, 0.25, 0.6, 0.99, 1].map(r.stopsReached), [1, 1, 1, 2, 3, 4, 5]);
  t('the first stop names the source', [r.trackingStops('GitHub')[0].line, r.trackingStops('Hugging Face')[0].line], ['Picked up at GitHub', 'Picked up at Hugging Face']);
  t('the last stop is the door', r.trackingStops('Docker Hub').at(-1).line, 'At your door');
  t('the offer waits at the depot', r.waitingLine('GitHub'), 'Packed and waiting at GitHub');

  // --- the release page -----------------------------------------------------------
  t('release page from the APK address', rel.releasePageOf('https://github.com/krishna-kush/PhoneCanDo/releases/download/v1.0.1/phonecando-1.0.1-full-arm64.apk'), 'https://github.com/krishna-kush/PhoneCanDo/releases/tag/v1.0.1');
  t('no page for another address', [rel.releasePageOf('https://example.com/x.apk'), rel.releasePageOf('')], [null, null]);

  // --- what the install stops ------------------------------------------------------
  t('jobs: Linux by step, models by kind', k.jobCounts(['download', 'verify', 'unpack', 'script', 'offline'], ['download', 'import']), {
    downloads: 4,
    setups: 3,
  });
  t('jobs: none', k.jobCounts([], []), { downloads: 0, setups: 0 });
  const none = { downloads: 0, setups: 0 };
  const a = { id: 'a', name: 'Builder', working: true };
  const b = { id: 'b', name: 'Helper', working: false };
  t('nothing running', [k.stopsHead([], none), k.stopRows([], none)], ['Nothing is running, so nothing stops. PhoneCanDo restarts on the new build.', []]);
  t('one idle agent', k.stopsHead([b], none), 'Installing stops 1 agent for a minute or so, while PhoneCanDo restarts on the new build.');
  t('agents, a busy one, and jobs', k.stopsHead([a, b], { downloads: 1, setups: 2 }), 'Installing stops 2 agents, 1 download and 2 setups (1 busy) for a minute or so, while PhoneCanDo restarts on the new build.');
  t('jobs alone', k.stopsHead([], { downloads: 2, setups: 0 }), 'Installing stops 2 downloads for a minute or so, while PhoneCanDo restarts on the new build.');
  const rows = k.stopRows([a, b], { downloads: 2, setups: 1 });
  t('rows: agents first, then downloads, then setups', rows.map((r) => `${r.kind}:${r.id}`), ['agent:a', 'agent:b', 'job:downloads', 'job:setups']);
  t('a busy agent is told about Continue', rows[0].line.includes('Continue'), true);
  t('an idle one starts when opened', rows[1].line, 'Idle. It stops now and starts again when you open it.');
  t('job titles count', [rows[2].title, rows[3].title], ['2 downloads', '1 setup']);
  t('one download pauses, several pause', [k.stopRows([], { downloads: 1, setups: 0 })[0].line.startsWith('Pauses'), rows[2].line.startsWith('Pause,')], [true, true]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

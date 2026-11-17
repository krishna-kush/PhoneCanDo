// First launch's setup screen (src/ui/setup/): its stages, how far into
// each and along the whole, the running agent's mood and the finale
// (logic/stage.ts), and the arcade's clock and tips (logic/clock.ts,
// copy.ts). Imports the real pure modules (Node 22.18+ strips their
// types), so these cannot drift.
// Run: node test_setup_scene.js (or pnpm check:vectors)
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
const near = (a, b) => Math.abs(a - b) < 1e-9;

(async () => {
  const s = await import(src('ui/setup/logic/stage.ts'));
  const k = await import(src('ui/setup/logic/clock.ts'));
  const c = await import(src('ui/setup/copy.ts'));

  // --- stages -----------------------------------------------------------------
  t('four stages: the image three, then the agent', s.STAGES, ['Unpacking', 'Detecting the system', 'Setting up', 'Starting your agent']);
  t('a level name for each', c.STAGE_SHORT.length, s.STAGES.length);
  t('before unpacking counts as unpacking', s.stageOf('linux', -1, false), 0);
  t('the image phases as they are', [0, 1, 2].map((p) => s.stageOf('linux', p, false)), [0, 1, 2]);
  t('image ready: the agent starts', s.stageOf('linux', 2, true), s.START_STAGE);
  t('Android: only the agent', s.stageOf('android', -1, false), s.START_STAGE);
  t('a phase past the image ones stays on setting up', s.stageOf('linux', 9, false), 2);

  // --- within a stage -------------------------------------------------------------
  t('unpacking: from the start', s.withinStage({ stage: 0, fraction: 0, done: false }), 0);
  t('unpacking: halfway at 0.4', near(s.withinStage({ stage: 0, fraction: 0.4, done: false }), 0.5), true);
  t('unpacking: done at 0.8', s.withinStage({ stage: 0, fraction: 0.8, done: false }), 1);
  t('detecting: halfway at 0.825', near(s.withinStage({ stage: 1, fraction: 0.825, done: false }), 0.5), true);
  t('setting up: from 0.85', s.withinStage({ stage: 2, fraction: 0.85, done: false }), 0);
  t('a fraction behind its stage: 0', s.withinStage({ stage: 2, fraction: 0.5, done: false }), 0);
  t('the agent starting: 0 until it exists', s.withinStage({ stage: 3, fraction: 1, done: false }), 0);
  t('done: all the way', s.withinStage({ stage: 3, fraction: 1, done: true }), 1);
  t('a bad fraction: 0', s.withinStage({ stage: 0, fraction: NaN, done: false }), 0);

  // --- along the whole track --------------------------------------------------------
  t('a level a stage', [0, 1, 2, 3].map((st) => s.overall({ stage: st, fraction: [0, 0.8, 0.85, 1][st], done: false })), [0, 0.25, 0.5, 0.75]);
  t('unpacking fills its level', near(s.overall({ stage: 0, fraction: 0.4, done: false }), 0.125), true);
  t('done: at the flag', s.overall({ stage: 3, fraction: 1, done: true }), 1);
  const steps = [0, 0.1, 0.3, 0.6, 0.8].map((f) => s.overall({ stage: 0, fraction: f, done: false }));
  t('only ever forward while unpacking', steps.every((v, i) => i === 0 || v >= steps[i - 1]), true);

  // --- the runner's mood, the levels' marks, the finale -----------------------------
  const mood = (done = false, failed = false) => s.runnerMood({ done, failed });
  t('running: eyes darting about', mood(), 'busy');
  t('pleased at the finale', mood(true), 'happy');
  t('frowning on a failure, finale or not', [mood(false, true), mood(true, true)], ['oops', 'oops']);
  t('marks while detecting', [0, 1, 2, 3].map((i) => s.stageMark(i, { stage: 1, done: false })), ['done', 'now', 'next', 'next']);
  t('marks at the finale: all done', [0, 1, 2, 3].map((i) => s.stageMark(i, { stage: 3, done: true })), ['done', 'done', 'done', 'done']);
  t('the finale lasts a moment', s.FINALE_MS > 0 && s.FINALE_MS <= 2500, true);

  // --- the clock and the tips -------------------------------------------------------
  t('the clock', [0, 7000, 61500, 600000].map(k.clock), ['00:00', '00:07', '01:01', '10:00']);
  t('a bad time reads zero', k.clock(-5), '00:00');
  t('tips in turn, round again', [0, 4999, 5000, 10000, 35000].map((ms) => k.tipAt(ms, 5000, 7)), [0, 0, 1, 2, 0]);
  t('no tips: the first', k.tipAt(9000, 5000, 0), 0);
  t('tips are short enough for two lines', c.ARCADE.tips.every((x) => x.length <= 80), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

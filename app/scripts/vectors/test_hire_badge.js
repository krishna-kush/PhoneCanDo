// The crew badge over the custom agent pages
// (src/ui/env/custom-agents/logic/badge.ts): what it ticks, its lines, its
// face's mood, the id its mascot is picked by, and the steps strip. Imports
// the real pure module (Node 22.18+ strips its types), so it cannot drift.
// Run: node test_hire_badge.js (or pnpm check:vectors)
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
  const b = await import(src('ui/env/custom-agents/logic/badge.ts'));
  const empty = { name: '', install: 'npm', installPackage: '', script: '', command: '', phoneTools: false };
  const done = (f) => b.badgeNeeds(f).map((n) => n.done);

  // --- needs ----------------------------------------------------------------------
  t('an empty form needs all three', done(empty), [false, false, false]);
  t('a name is in', done({ ...empty, name: ' Aider ' }), [true, false, false]);
  t('blank space is not a name', done({ ...empty, name: '   ' })[0], false);
  t('a package install needs its package', done({ ...empty, installPackage: 'aider-chat' })[1], true);
  t('a script install needs its script', [done({ ...empty, install: 'script' })[1], done({ ...empty, install: 'script', script: 'pip install x' })[1]], [false, true]);
  t('nothing to install is always in', done({ ...empty, install: 'none' })[1], true);
  const all = { ...empty, name: 'Aider', installPackage: 'aider-chat', command: 'aider' };
  t('count', [b.needsCount(b.badgeNeeds(empty)), b.needsCount(b.badgeNeeds({ ...empty, name: 'A' })), b.needsCount(b.badgeNeeds(all))], [
    '0 of 3',
    '1 of 3',
    'all in',
  ]);

  // --- mood -----------------------------------------------------------------------
  t('asleep, busy, awake', [b.badgeMood(b.badgeNeeds(empty), 0), b.badgeMood(b.badgeNeeds({ ...empty, name: 'A' }), 0), b.badgeMood(b.badgeNeeds(all), 0)], [
    'asleep',
    'busy',
    'awake',
  ]);
  t('a problem frowns, however full', b.badgeMood(b.badgeNeeds(all), 2), 'oops');

  // --- lines ----------------------------------------------------------------------
  t('program from a path', b.programOf('  /root/.local/bin/aider --no-auto-commits'), 'aider');
  t('no program', b.programOf(''), '');
  t('form lines', b.badgeLines({ ...all, phoneTools: true }), [
    { term: 'Installs', value: 'npm package · aider-chat' },
    { term: 'Starts', value: 'aider' },
    { term: 'Tools', value: 'phone tools on' },
  ]);
  t('script lines counted', b.badgeLines({ ...empty, install: 'script', script: 'a\n\nb\nc' })[0].value, 'Install script · 3 lines');
  t('nothing yet', b.badgeLines(empty).map((l) => l.value), ['npm package', '—', 'no phone tools']);
  const review = { installSteps: ['pip install x'], packages: [], runtimes: [], command: 'aider --yes', phoneTools: false };
  t('review lines', b.reviewBadgeLines(review).map((l) => l.value), ['1 step, as root', 'aider', 'no phone tools']);
  t('review: packages only', b.reviewBadgeLines({ ...review, installSteps: [], packages: [{ family: '*', names: ['git'] }] })[0].value, 'packages only');
  t('review: nothing', b.reviewBadgeLines({ ...review, installSteps: [] })[0].value, 'nothing');

  // --- id, words ------------------------------------------------------------------
  t('an edit keeps its id', b.badgeId('user.aider', 'Renamed', []), 'user.aider');
  t('a new one gets the id it will be saved under', [b.badgeId(null, 'Aider', []), b.badgeId(null, 'Aider', ['user.aider'])], ['user.aider', 'user.aider-2']);
  t('no name yet', b.badgeId(null, '  ', []), 'user.agent');
  t('kickers', ['new', 'edit', 'import'].map(b.badgeKicker), ['Crew badge · new hire', 'Crew badge · on file', 'Crew badge · transfer']);
  t('stamps', ['new', 'edit', 'import'].map(b.reviewStamp), ['Ready to hire', 'Ready to file', 'Ready to hire']);

  // --- steps ----------------------------------------------------------------------
  t('step labels', [b.stepLabel(b.FORM_STEPS, 0, 0), b.stepLabel(b.FORM_STEPS, 1, 0), b.stepLabel(b.FORM_STEPS, 0, 1)], ['01 Fill in', '02 Review', '✓ Fill in']);
  t('spoken', b.stepSpoken(b.IMPORT_STEPS, 1), 'Step 2 of 2, Review');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

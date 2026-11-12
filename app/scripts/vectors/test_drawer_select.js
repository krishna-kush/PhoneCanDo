// The drawer's selection (src/ui/drawer/select/logic/selection.ts): picking
// in the drawer's order, dropping deleted agents, All/None, which engines
// Stop can bring down, and what the delete confirm says. Imports the real
// pure module (Node 22.18+ strips its types), so these cannot drift.
// Run: node test_drawer_select.js (or pnpm check:vectors)
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
  const s = await import(src('ui/drawer/select/logic/selection.ts'));
  const order = ['a', 'b', 'c'];

  // --- picking ---------------------------------------------------------------
  t('a pick adds it', s.togglePick([], 'b', order), ['b']);
  t('picks keep the drawer order', s.togglePick(['c'], 'a', order), ['a', 'c']);
  t('a second tap unpicks it', s.togglePick(['a', 'c'], 'a', order), ['c']);
  t('the last unpick leaves none', s.togglePick(['b'], 'b', order), []);

  // --- agents that went ------------------------------------------------------
  const kept = ['a', 'c'];
  t('nothing gone: the same array', s.keepPresent(kept, order) === kept, true);
  t('a deleted agent drops out', s.keepPresent(['a', 'c'], ['a', 'b']), ['a']);
  t('every picked agent gone: none', s.keepPresent(['c'], ['a']), []);

  // --- All / None ------------------------------------------------------------
  t('all picked', s.allPicked(['a', 'b', 'c'], order), true);
  t('some picked is not all', s.allPicked(['a', 'c'], order), false);
  t('no agents is never all', s.allPicked([], []), false);

  // --- Stop ------------------------------------------------------------------
  t('Stop takes a ready engine', s.canStop('ready'), true);
  t('Stop takes a starting engine', s.canStop('starting'), true);
  for (const state of ['stopped', 'stopping', 'died', 'failed', undefined, null]) {
    t(`Stop skips ${state}`, s.canStop(state), false);
  }

  // --- copy ------------------------------------------------------------------
  t('count line', s.pickedLine(3), '3 selected');
  t('one: titled by name', s.deleteTitle(['Bob']), 'Delete Bob?');
  t('several: titled by count', s.deleteTitle(['Bob', 'Ann']), 'Delete 2 agents?');
  const tail = ' with everything in it: projects, chats, keys and installed tools.';
  t('one, measuring', s.deleteMessage(['Bob'], null, false), `This deletes the agent and its machine${tail} Measuring their size…`);
  t(
    'several, measured',
    s.deleteMessage(['Bob', 'Ann', 'Cy'], 2_400_000_000, false),
    `This deletes Bob, Ann and Cy, each with its machine${tail} That frees about 2.4 GB.`,
  );
  t('size unknown: no size line', s.deleteMessage(['Bob', 'Ann'], 0, false), `This deletes Bob and Ann, each with its machine${tail}`);
  t(
    'the only agent',
    s.deleteMessage(['Bob'], 0, true),
    `This deletes the agent and its machine${tail} It's your only agent, so we'll set up a fresh one right after.`,
  );
  t(
    'every agent',
    s.deleteMessage(['Bob', 'Ann'], 0, true),
    `This deletes Bob and Ann, each with its machine${tail} That's every agent, so we'll set up a fresh one right after.`,
  );
  t('no failures: no line', s.failedLine([]), null);
  t('one failure', s.failedLine([{ name: 'Bob', reason: 'Busy.' }]), "Couldn't delete Bob: Busy.");
  t(
    'several failures: the first reason',
    s.failedLine([{ name: 'Bob', reason: 'Busy.' }, { name: 'Ann', reason: 'Gone.' }]),
    "Couldn't delete Bob and Ann. Busy.",
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

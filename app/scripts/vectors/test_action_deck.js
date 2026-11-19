// A deck of a page's buttons (src/ui/common/actions/logic/deal.ts): which
// group each button goes in and which share a row. Imports the real pure
// module (Node 22.18+ strips its types), so these cannot drift.
// Run: node test_action_deck.js
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
const labels = (xs) => xs.map((x) => x.label);
const rows = (rs) => rs.map(labels);

(async () => {
  const d = await import(src('ui/common/actions/logic/deal.ts'));

  // The schedule editor's four, one of them hidden on a new schedule.
  const editor = [
    { label: 'Save', role: 'go' },
    { label: 'Run now' },
    { label: 'Cancel', role: 'back' },
    { label: 'Delete', role: 'danger' },
  ];
  const dealt = d.deal(editor);
  t('main act', labels(dealt.go), ['Save']);
  t('no role is another act', labels(dealt.more), ['Run now']);
  t('a way back', labels(dealt.back), ['Cancel']);
  t("can't be undone", labels(dealt.danger), ['Delete']);
  t('hidden buttons drop', labels(d.deal([editor[0], null, false, undefined, editor[2]]).back), ['Cancel']);
  t('order kept in a group', labels(d.deal([{ label: 'B' }, { label: 'A' }]).more), ['B', 'A']);

  t('two short labels share a row', rows(d.pairsOf([{ label: 'Run now' }, { label: 'Cancel' }])), [['Run now', 'Cancel']]);
  t('a lone one takes the row', rows(d.pairsOf([{ label: 'A' }, { label: 'B' }, { label: 'C' }])), [['A', 'B'], ['C']]);
  t(
    'a long label takes its own row, the short one before it too',
    rows(d.pairsOf([{ label: 'Open chat' }, { label: 'Open terminal in the machine' }, { label: 'Stop' }])),
    [['Open chat'], ['Open terminal in the machine'], ['Stop']],
  );
  t('exactly PAIR_CHARS still pairs', d.pairsOf([{ label: 'x'.repeat(d.PAIR_CHARS) }, { label: 'y' }]).length, 1);
  t('one over does not', d.pairsOf([{ label: 'x'.repeat(d.PAIR_CHARS + 1) }, { label: 'y' }]).length, 2);
  t('nothing, no rows', d.pairsOf([]), []);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();

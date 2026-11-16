// A custom agent kind's mascot (src/ui/env/custom-agents/logic/kindLook.ts):
// the one its id picks, which must stay the same for the same id. Imports
// the real pure module (Node 22.18+ strips its types), so it cannot drift.
// Run: node test_kind_look.js (or pnpm check:vectors)
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
const repo = (...parts) => pathToFileURL(path.join(__dirname, '../../..', ...parts)).href;

(async () => {
  const c = await import(src('ui/env/custom-agents/logic/kindLook.ts'));
  const p = await import(repo('mascot/pick.ts'));
  const l = await import(repo('mascot/look.ts'));
  const { pickIndex } = await import(src('ui/common/keyPick.ts'));

  // --- the hash -----------------------------------------------------------------
  const ids = ['aider', 'goose', 'crush', 'amp', 'cline', 'plandex', 'mentat', 'kilo'];
  t('an id always picks the same one', ids.map((x) => pickIndex(x, 9)), ids.map((x) => pickIndex(x, 9)));
  t('picks stay in range', ids.every((x) => { const i = pickIndex(x, 9); return i >= 0 && i < 9; }), true);
  t('the empty id picks the first FNV bucket', pickIndex('', 9), 0x811c9dc5 % 9);

  // --- picks by id --------------------------------------------------------------
  const keys = new Set(p.allLooks().map(l.lookKey));
  t('the mascot is a real look', keys.has(l.lookKey(c.kindLook('aider'))), true);
  t('the same id, the same mascot', l.lookKey(c.kindLook('aider')), l.lookKey(c.kindLook('aider')));
  const many = new Set(['aider', 'goose', 'crush', 'amp', 'cline', 'plandex', 'mentat', 'kilo'].map((id) => l.lookKey(c.kindLook(id))));
  t('eight ids, more than one mascot', many.size > 1, true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

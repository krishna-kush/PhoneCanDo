// Shadow-document reconciler vectors. Standalone so plain `node` runs them.
// RECONSTRUCTED 2026-10-07: the /tmp original was lost (only modifiers
// survived). These mirror src/ui/terminal/reconcile.ts semantics.
// Run: node test_shadow.js (or pnpm check:vectors)
'use strict';
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name} got=${q(got)} want=${q(want)}`);
}
// diffToEdit core: common prefix/suffix untouched, middle -> DELs + inserts.
function diffToEdit(prev, next) {
  let start = 0;
  const m = Math.min(prev.length, next.length);
  while (start < m && prev[start] === next[start]) start++;
  let endP = prev.length;
  let endN = next.length;
  while (endP > start && endN > start && prev[endP - 1] === next[endN - 1]) {
    endP--;
    endN--;
  }
  return { dels: endP - start, ins: next.slice(start, endN) };
}
function diffToKeys(prev, next) {
  const { dels, ins } = diffToEdit(prev, next);
  return '\x7f'.repeat(dels) + ins;
}
t('typing append', diffToEdit('ab', 'abc'), { dels: 0, ins: 'c' });
t('backspace one', diffToEdit('abc', 'ab'), { dels: 1, ins: '' });
t('word delete', diffToEdit('foo bar', 'foo '), { dels: 3, ins: '' });
t('glide commit', diffToEdit('a', 'apple'), { dels: 0, ins: 'pple' });
t('autocorrect replace', diffToEdit('teh', 'the'), { dels: 2, ins: 'he' });
t('no-op', diffToEdit('ab', 'ab'), { dels: 0, ins: '' });
t('clear line', diffToEdit('abc', ''), { dels: 3, ins: '' });
t('keys pipe insert', diffToKeys('a', 'a|'), '|');
t('keys word delete', diffToKeys('foo bar', 'foo '), '\x7f\x7f\x7f');
console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

// Modifier mapping vectors. Standalone so plain `node` runs them.
// CORRECTED 2026-10-07: the /tmp original used '\Pt' (== 'Pt') and '\x1bZ'
// (missing bracket) in both impl and expectation, so shift+tab passed
// without testing anything real. These match src/ui/terminal/keys.ts.
// Run: node test_modifiers.js (or pnpm check:vectors)
'use strict';
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name} got=${q(got)} want=${q(want)}`);
}
// applyInsertMods core: Ctrl+letter -> 0x01..0x1A (lowercased first).
// Digits/symbols pass through (no classic mapping).
function ctrlChar(ch) {
  if (/[a-zA-Z]/.test(ch)) return String.fromCharCode(ch.toLowerCase().codePointAt(0) - 96);
  return ch;
}
t('ctrl l', ctrlChar('l'), '\x0c');
t('ctrl L (upper)', ctrlChar('L'), '\x0c');
t('ctrl c', ctrlChar('c'), '\x03');
t('ctrl space passes through', ctrlChar(' '), ' ');
t('ctrl digit passes through', ctrlChar('1'), '1');
t('shift letter', 'a'.toUpperCase(), 'A');
// modifiedSeq core: arrows gain ;mod (2=shift 5=ctrl 6=both), Shift+Tab is CSI Z.
function modifiedSeq(seq, ctrl, shift) {
  if (!ctrl && !shift) return seq;
  const m = seq.match(/^\x1b\[([ABCD])$/);
  if (m) {
    const mod = ctrl && shift ? 6 : ctrl ? 5 : 2;
    return `\x1b[1;${mod}${m[1]}`;
  }
  if (seq === '\t' && shift && !ctrl) return '\x1b[Z';
  return seq;
}
t('shift+up', modifiedSeq('\x1b[A', false, true), '\x1b[1;2A');
t('ctrl+up', modifiedSeq('\x1b[A', true, false), '\x1b[1;5A');
t('ctrl+shift+left', modifiedSeq('\x1b[D', true, true), '\x1b[1;6D');
t('shift+tab', modifiedSeq('\t', false, true), '\x1b[Z');
t('esc+ctrl unchanged', modifiedSeq('\x1b', true, false), '\x1b');
t('plain up unchanged', modifiedSeq('\x1b[A', false, false), '\x1b[A');
console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

// What our terminal answers a program that asks about it
// (src/ui/terminal/theme/replies.ts): colours in xterm's words, the theme
// report of DEC mode 2031 / CSI ? 996 n, device attributes and the status.
// The runner's kit-term TermTheme says the same for an engine's PTY
// (TermThemeTest); keep the two in step. Imports the real pure module
// (Node 22.18+ strips its types), so these cannot drift.
// Run: node test_term_replies.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${ok ? '' : ` got=${q(got)} want=${q(want)}`}`);
}
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;

const ansi = Array.from({ length: 16 }, (_, i) => '#' + [i, i * 2, i * 3].map((c) => c.toString(16).padStart(2, '0')).join(''));
const dark = { dark: true, foreground: '#e6e6e6', background: '#0a0a0a', cursor: '#00ff00', ansi };
const light = { dark: false, foreground: '#1a1a1a', background: '#ffffff', cursor: '#1a7f37', ansi };
const ST = '\x1b\\';

(async () => {
  const { answer, themeReport, paletteRgb } = await import(src('ui/terminal/theme/replies.ts'));
  const osc = (code, data, colors = dark) => answer({ q: 'osc', code, data }, colors);

  t('background, as xterm words it', osc(11, '?'), `\x1b]11;rgb:0a0a/0a0a/0a0a${ST}`);
  t('background in light', osc(11, '?', light), `\x1b]11;rgb:ffff/ffff/ffff${ST}`);
  t('foreground', osc(10, '?'), `\x1b]10;rgb:e6e6/e6e6/e6e6${ST}`);
  t('cursor', osc(12, '?'), `\x1b]12;rgb:0000/ffff/0000${ST}`);
  t('10;?;? asks for 10 and 11', osc(10, '?;?'), `\x1b]10;rgb:e6e6/e6e6/e6e6${ST}\x1b]11;rgb:0a0a/0a0a/0a0a${ST}`);
  t('a field that sets asks nothing', osc(10, '#ffffff;?'), `\x1b]11;rgb:0a0a/0a0a/0a0a${ST}`);
  t('past 12, nothing', osc(12, '?;?'), `\x1b]12;rgb:0000/ffff/0000${ST}`);
  t('a set alone, nothing', osc(11, '#000000'), '');
  t('palette pairs', osc(4, '3;?;5;#ffffff;196;?'), `\x1b]4;3;rgb:0303/0606/0909${ST}\x1b]4;196;rgb:ffff/0000/0000${ST}`);
  t('palette past 255 or not a number, nothing', osc(4, '256;?;x;?'), '');
  t('grey ramp', q(paletteRgb(dark, 255)), q([238, 238, 238]));
  t('cube', q(paletteRgb(dark, 16 + 36 + 2 * 6 + 3)), q([95, 135, 175]));
  t('theme query, dark', answer({ q: 'theme' }, dark), '\x1b[?997;1n');
  t('theme query, light', answer({ q: 'theme' }, light), '\x1b[?997;2n');
  t('theme report on a change to light', themeReport(false), '\x1b[?997;2n');
  t('device attributes, as xterm.js', answer({ q: 'attributes' }, light), '\x1b[?1;2c');
  t('status OK', answer({ q: 'status' }, light), '\x1b[0n');

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();

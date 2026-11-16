// Settings → Privacy's words (src/ui/settings/privacy/copy.ts) against the
// published truth, docs/telemetry.md: what the page says is never sent is
// in the doc's "Never sent" line, and each claim keeps its wording. Imports
// the real pure module (Node 22.18+ strips its types), so it cannot drift.
// Run: node test_privacy_page.js (or pnpm check:vectors)
'use strict';
const fs = require('node:fs');
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
  const c = await import(src('ui/settings/privacy/copy.ts'));
  const doc = fs.readFileSync(path.join(__dirname, '../../../docs/telemetry.md'), 'utf8');
  const neverLine = (doc.match(/\*\*Never sent:\*\*[^\n]*\n[^\n]*/) ?? [''])[0].toLowerCase();

  t('the doc has its Never sent line', neverLine.length > 0, true);
  const words = { 'Your chats': 'chats', Files: 'files', Keys: 'keys', 'Anything on your screen': 'screen' };
  t('every NEVER line is in the doc', c.NEVER.every((n) => neverLine.includes(words[n])), true);
  t('four never lines', c.NEVER.length, 4);
  t('declared, as the page said it', c.DECLARED, [
    'Your device type',
    'Android and app version',
    'Crashes',
    'Engine health',
    'How often features are used',
  ]);
  t('declared under an anonymous ID', c.DECLARED_NOTE.includes('random anonymous ID'), true);
  t('off drops the unsent queue', c.OFF_MEANS, 'Off stops it and deletes what has not been sent yet.');
  t('switch line', [c.statsNote(false, true), c.statsNote(true, true), c.statsNote(true, false)], [
    'Loading…',
    'On · helps find bugs',
    'Off · nothing is sent',
  ]);
  t('guard on and off duty', [c.guardLine(true, true).title, c.guardLine(true, false).title], ['A-01 · on duty', 'A-01 · off duty']);
  t('share links: never who', c.ALSO[0].note.includes('Never who.'), true);
  t('sign-in kept apart from stats', c.ALSO[1].note.includes('never link them to these usage stats'), true);
  t('delete: usage data only, not the account', c.FORGET_NOTE.startsWith('All usage data'), true);
  t('report: only when tapped', c.REPORT_NOTE.includes('Only when you tap it'), true);
  t('reset keeps sent data linked', c.RESET_NOTE.includes('Data already sent stays linked to this phone'), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

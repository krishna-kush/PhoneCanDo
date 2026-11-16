// The Account page's crew pass (src/ui/account/logic/pass.ts): its fields
// signed in and blank, A-01's line by the door, what follows you, and the
// date it is issued on (src/ui/account/copy.ts). Imports the real pure
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_account_pass.js (or pnpm check:vectors)
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
  const p = await import(src('ui/account/logic/pass.ts'));
  const c = await import(src('ui/account/copy.ts'));

  const day = new Date(2026, 10, 16, 12).getTime();
  t('issued on', c.sinceDate(day), '16 Nov 2026');

  t('a signed-in pass', p.passFields({ name: 'Sam Doe', email: 'sam@example.com' }, day), [
    { term: 'Name', value: 'Sam Doe' },
    { term: 'Email', value: 'sam@example.com' },
    { term: 'Since', value: '16 Nov 2026' },
    { term: 'Issuer', value: 'A-01 · PhoneCanDo' },
  ]);
  t('no name: the email stands in', p.passFields({ name: '  ', email: 'sam@example.com' }, day)[0].value, 'sam@example.com');
  t('no name, no email', p.passFields({ name: null, email: '' }, day).slice(0, 2).map((f) => f.value), ['you', '—']);
  t('before the server answers', p.passFields({ name: 'Sam', email: 's@x' }, null)[2].value, 'checking…');
  t('the server could not be reached', p.passFields({ name: 'Sam', email: 's@x' }, null, true)[2].value, '—');
  t('a date beats a late failure', p.passFields({ name: 'Sam', email: 's@x' }, day, true)[2].value === '—', false);
  t('blank pass: same terms', p.BLANK_FIELDS.map((f) => f.term), ['Name', 'Email', 'Since', 'Issuer']);
  t('blank pass: your name here', p.BLANK_FIELDS[0].value, 'Your name here');

  t('door lines', ['idle', 'signingIn', 'failed'].map(p.doorLine), [
    'A-01 · holding the door. No rush.',
    'A-01 · checking your ID…',
    "A-01 · that didn't take. Try again?",
  ]);

  t('what follows you', p.FOLLOWS.map((f) => f.title), ['Share links', 'Theme', 'Extra keys', 'Run caps']);
  t('each named in the synced line', p.FOLLOWS.every((f) => c.SYNCED.toLowerCase().includes(f.title.toLowerCase())), true);
  t('where it lives', [p.followsNow(true), p.followsNow(false)], ['follows you', 'this phone']);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

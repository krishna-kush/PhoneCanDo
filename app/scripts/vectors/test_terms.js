// The license ask (src/ui/terms/): when it asks and when it asks again
// (logic/agreement.ts), the stored agreement read back
// (src/state/logic/licenseAgreed.ts), the license's text joined into
// blocks for the phone to wrap without losing a word (logic/blocks.ts), the
// generated text's version (licenseText.ts) and the words (copy.ts). The
// agreement is this install's alone: never a synced setting. Imports the
// real pure modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_terms.js (or pnpm check:vectors)
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
const words = (s) => s.split(/\s+/).filter(Boolean);

(async () => {
  const { needsAgreement, isReAsk, asksOnItsOwn } = await import(src('ui/terms/logic/agreement.ts'));
  const { licenseBlocks, licenseTitle } = await import(src('ui/terms/logic/blocks.ts'));
  const { LICENSE_TEXT, LICENSE_VERSION } = await import(src('ui/terms/licenseText.ts'));
  const c = await import(src('ui/terms/copy.ts'));
  const { licenseAgreement, readLicenseAgreed } = await import(src('state/logic/licenseAgreed.ts'));
  const { SYNCED_KEYS, PREF_KEYS } = await import(src('state/logic/settingsSync/keys.ts'));
  const { dayMonthYear } = await import(src('ui/common/dates.ts'));

  // --- when it asks ----------------------------------------------------------------
  t('never agreed (first launch, or a 1.0.0 user): up', needsAgreement(null, '1.1'), true);
  t('agreed to an older version: up', needsAgreement('1.0', '1.1'), true);
  t('agreed to this version: down', needsAgreement('1.1', '1.1'), false);
  t('agreed to another version (an older build): up', needsAgreement('1.2', '1.1'), true);
  t('the first time is no re-ask', isReAsk(null, '1.1'), false);
  t('an older version agreed: a re-ask', isReAsk('1.0', '1.1'), true);
  t('this version agreed: nothing to ask', isReAsk('1.1', '1.1'), false);
  const ask = (o) => asksOnItsOwn({ stored: null, current: '1.1', setUp: true, helloPending: false, ...o });
  t('during first launch the sheet stays away', ask({ setUp: false }), false);
  t('while the hello waits, it asks instead', ask({ helloPending: true }), false);
  t('a 1.0.0 install after onboarding: the sheet asks', ask({}), true);
  t('a new version after onboarding: the sheet asks', ask({ stored: '1.0' }), true);
  t('this version agreed: never', ask({ stored: '1.1' }), false);

  // --- the stored agreement ----------------------------------------------------------
  const at = new Date('2026-11-18T12:00:00.000Z');
  const agreed = licenseAgreement('1.1', at);
  t('agreeing keeps the version and when', agreed, { version: '1.1', at: '2026-11-18T12:00:00.000Z' });
  t('it reads back as stored', readLicenseAgreed(JSON.stringify(agreed)), agreed);
  t('nothing stored: never agreed', [readLicenseAgreed(null), readLicenseAgreed(undefined), readLicenseAgreed('')], [null, null, null]);
  t('not JSON: never agreed', readLicenseAgreed('1.1'), null);
  t('not an object: never agreed', [readLicenseAgreed('"1.1"'), readLicenseAgreed('null'), readLicenseAgreed('[]')], [null, null, null]);
  t('no version: never agreed', readLicenseAgreed('{"at":"2026-11-18T12:00:00.000Z"}'), null);
  t('an empty version: never agreed', readLicenseAgreed('{"version":"","at":"x"}'), null);
  t('no date: never agreed', readLicenseAgreed('{"version":"1.1"}'), null);
  t('extra fields are dropped', readLicenseAgreed('{"version":"1.1","at":"x","by":"me"}'), { version: '1.1', at: 'x' });

  // --- never synced -------------------------------------------------------------------
  t('the agreement is no synced setting', SYNCED_KEYS.includes('licenseAgreed'), false);
  t('nor a synced pref', PREF_KEYS.includes('licenseAgreed'), false);

  // --- the text as blocks -------------------------------------------------------------
  const sample = [
    'Example License 2.0',
    '',
    'Copyright line.',
    '',
    '1. First',
    '',
    'A paragraph that wraps',
    'over two lines.',
    '',
    'You may not:',
    '- sell it;',
    '- share its files',
    '  with anyone.',
    '',
    'a. Lettered: wraps',
    '   onto an indented line.',
    'b. Second, with a list:',
    '   - nested one',
    '     continued;',
    '   - nested two.',
    'c. Third.',
    '',
    '2. A numbered line',
    'that wraps is a paragraph.',
    '',
    'e.g. this is no item',
    'and goes on.',
    '',
  ].join('\n');
  t('a sample, block by block', licenseBlocks(sample), [
    { kind: 'title', text: 'Example License 2.0' },
    { kind: 'paragraph', text: 'Copyright line.' },
    { kind: 'heading', text: '1. First' },
    { kind: 'paragraph', text: 'A paragraph that wraps over two lines.' },
    { kind: 'paragraph', text: 'You may not:' },
    { kind: 'item', mark: '-', depth: 0, text: 'sell it;' },
    { kind: 'item', mark: '-', depth: 0, text: 'share its files with anyone.' },
    { kind: 'item', mark: 'a.', depth: 0, text: 'Lettered: wraps onto an indented line.' },
    { kind: 'item', mark: 'b.', depth: 0, text: 'Second, with a list:' },
    { kind: 'item', mark: '-', depth: 1, text: 'nested one continued;' },
    { kind: 'item', mark: '-', depth: 1, text: 'nested two.' },
    { kind: 'item', mark: 'c.', depth: 0, text: 'Third.' },
    { kind: 'paragraph', text: '2. A numbered line that wraps is a paragraph.' },
    { kind: 'paragraph', text: 'e.g. this is no item and goes on.' },
  ]);
  t('Windows line ends read the same', licenseBlocks(sample.replace(/\n/g, '\r\n')), licenseBlocks(sample));
  t('the title is the first line', licenseTitle(sample), 'Example License 2.0');
  t('no text, no blocks', licenseBlocks(''), []);

  // --- our license ---------------------------------------------------------------------
  const blocks = licenseBlocks(LICENSE_TEXT);
  const fromBlocks = blocks.flatMap((b) => [...(b.kind === 'item' ? [b.mark] : []), ...words(b.text)]);
  t('the blocks keep every word of LICENSE, in order', fromBlocks.join(' ') === words(LICENSE_TEXT).join(' '), true);
  t('it opens with its title', blocks[0], { kind: 'title', text: licenseTitle(LICENSE_TEXT) });
  t('the title names the version the gate asks for', licenseTitle(LICENSE_TEXT).endsWith(` ${LICENSE_VERSION}`), true);
  t('the version is a number', /^\d+(\.\d+)*$/.test(LICENSE_VERSION), true);
  const headings = blocks.filter((b) => b.kind === 'heading');
  t('it has numbered sections', headings.length > 0, true);
  t('every heading is a numbered section', headings.every((b) => /^\d+\.\s\S/.test(b.text)), true);
  t('no block keeps a line break', blocks.every((b) => !b.text.includes('\n')), true);

  // --- the words ------------------------------------------------------------------------
  t('the kicker names the version', c.askKicker('1.1'), 'PhoneCanDo · license 1.1');
  t('first time, then a re-ask', [c.askTitle(false), c.askTitle(true)], ['One thing before you carry on', 'Our license changed']);
  const short = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../legal/summary.json'), 'utf8')).lines;
  t('the short version (legal/summary.json): four lines', short.length, 4);
  t('it says what it forbids', short.some((l) => l.startsWith('Not to sell')), true);
  t('I agree takes the whole license, by its name', c.wholeLicenseLine(licenseTitle(LICENSE_TEXT)).includes(`full ${licenseTitle(LICENSE_TEXT)},`), true);
  t('a re-ask says it changed, and to which version', c.changedLine('1.1'), 'Our license changed: this is version 1.1.');
  t('the buttons', [c.READ, c.AGREE], ['Read the license', 'I agree']);
  t("About's row: the version, and when you agreed", c.agreedLine('1.1', agreed), `version 1.1 · agreed ${dayMonthYear(at)}`);
  t("About's row: never agreed, the version alone", c.agreedLine('1.1', null), 'version 1.1');
  t("About's row: another version's date is not shown", c.agreedLine('1.1', { version: '1.0', at: agreed.at }), 'version 1.1');
  t("About's row: a broken date is not shown", c.agreedLine('1.1', { version: '1.1', at: 'soon' }), 'version 1.1');
  const all = [c.askKicker('1'), c.askTitle(true), c.askTitle(false), ...short, c.wholeLicenseLine('X'), c.changedLine('1'), c.TEXT_HEAD, c.TEXT_NOTE, c.ABOUT_ROW.label, c.ABOUT_ROW.note].join(' ');
  t('the words say we and you, never the owner', /\bowner/i.test(all), false);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

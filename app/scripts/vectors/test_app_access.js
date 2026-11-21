// App access (src/ui/app-access/): the question an agent's first reach into
// an app puts to you (copy.ts), Settings → Phone control → Apps' row and
// page (logic/layout.ts), and which changes ask for your
// fingerprint first (logic/choices.ts).
// Imports the real pure modules (Node 22.18+ strips their types), so these
// cannot drift.
// Run: node test_app_access.js (or pnpm check:vectors)
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
  const c = await import(src('ui/app-access/copy.ts'));
  const ch = await import(src('ui/app-access/logic/choices.ts'));
  const lay = await import(src('ui/app-access/logic/layout.ts'));
  const deal = await import(src('ui/common/actions/logic/deal.ts'));
  const { BARCODE_LINES } = await import(src('ui/common/rows/barcode/lines.ts'));

  const app = (pkg, state, label = pkg) => ({ package: pkg, label, state });

  // What an app is called: its label, else its package, else "an app".
  t('name: the label', c.appName('Bank', 'com.bank'), 'Bank');
  t('name: no label, the package', [c.appName('', 'com.bank'), c.appName('  ', 'com.bank'), c.appName(null, 'com.bank')], ['com.bank', 'com.bank', 'com.bank']);
  t('name: neither', c.appName('', ''), 'an app');

  // The question.
  t('question: who and which app', c.questionLine('Resident', 'Bank'), 'Resident wants to use Bank.');
  t('question: an agent with no name', c.questionLine('', 'Bank'), 'An agent wants to use Bank.');
  t('just now: that agent, until it hands the phone back', c.justNowLine('Resident'), 'Just now: only Resident, until it hands the phone back.');
  t('just now: no name', c.justNowLine(''), 'Just now: only this agent, until it hands the phone back.');
  t('always: every agent, and your fingerprint', [c.ALWAYS_LINE.includes('every agent'), c.ALWAYS_LINE.includes('fingerprint')], [true, true]);
  t('no: every agent, until you change it in Settings', [c.NO_LINE.includes('every agent'), c.NO_LINE.includes('Settings → Phone control → Apps')], [true, true]);
  t('the keys', [c.KEY_ALWAYS, c.KEY_ONCE, c.KEY_NO], ['Always', 'Just now', 'No']);
  t('always: the fingerprint prompt names the app', c.alwaysAuthTitle('Bank'), 'Always allow Bank');
  // Just now and No sit side by side under Always.
  t('Just now and No share a row', deal.pairsOf([{ label: c.KEY_ONCE }, { label: c.KEY_NO }]).map((r) => r.length), [2]);

  // The Phone control row: how it stands now.
  t('row: nothing answered', c.appsNow(false, []), 'each app asks first');
  t('row: answered both ways', c.appsNow(false, [app('a', 'always'), app('b', 'always'), app('c', 'blocked')]), '2 always · 1 blocked');
  t('row: only always', c.appsNow(false, [app('a', 'always')]), '1 always');
  t('row: only blocked', c.appsNow(false, [app('c', 'blocked')]), '1 blocked');
  t('row: allow all, the blocked still told', c.appsNow(true, [app('a', 'always'), app('c', 'blocked')]), 'all apps allowed · 1 blocked');
  t('row: allow all, none blocked', c.appsNow(true, [app('a', 'always')]), 'all apps allowed');

  // Allow all apps.
  t('switch: on lets every app through', c.allowAllNote(true), 'Agents use any app without asking you first.');
  t('switch: off says turning on needs the fingerprint', c.allowAllNote(false).includes('fingerprint'), true);
  t('switch: blocked apps stay blocked', c.BLOCKED_STAY, 'Apps you blocked stay blocked either way.');
  t('switch: off, only that blocked apps stay blocked', c.allowAllMore(false), c.BLOCKED_STAY);
  t('switch: on, the blocked list needs the fingerprint too', c.allowAllMore(true), "Apps you blocked stay blocked either way. While it's on, changing the blocked list needs your fingerprint or screen lock.");
  t('allow all turned off by an unconfirmed block', c.ALLOW_ALL_TURNED_OFF, "Allow all apps is off now: changing the blocked list while it's on needs your fingerprint or screen lock.");
  t('block: the fingerprint prompt names the app', c.blockAuthTitle('Bank'), 'Block Bank');
  t('states on the rows', [c.STATE_WORD.always, c.STATE_WORD.blocked], ['always', 'blocked']);
  t('state lines', [c.stateLine('always'), c.stateLine('blocked')], ['Every agent may use it without asking.', 'Blocked for every agent.']);

  // An app's pop-up: the changes it offers, the main one first.
  t('always: block it, or ask again', ch.choicesFor('always'), ['blocked', 'none']);
  t('blocked: always allow it, or ask again', ch.choicesFor('blocked'), ['always', 'none']);
  t('choice keys', ['always', 'blocked', 'none'].map((k) => c.CHOICE_LABEL[k]), ['Always allow', 'Block', 'Ask again']);
  t('Block and Ask again share a row', deal.pairsOf([{ label: c.CHOICE_LABEL.blocked }, { label: c.CHOICE_LABEL.none }]).map((r) => r.length), [2]);

  // Every change that lets agents in further asks first; the rest never do,
  // except, while Allow all apps is on, any change to the blocked list.
  // 'none' as `from`: an app not answered yet (the slip's question).
  const moves = [
    ['always', 'blocked'],
    ['always', 'none'],
    ['blocked', 'always'],
    ['blocked', 'none'],
    ['none', 'always'],
    ['none', 'blocked'],
  ];
  const each = (fn, all) => moves.map(([from, to]) => fn(from, to, all));
  t('allow all off, confirm: to always, or a blocked app asked again', each(ch.needsConfirm, false), [false, false, true, true, true, false]);
  t('allow all off, strong only where native signs (always)', each(ch.strongConfirm, false), [false, false, true, false, true, false]);
  t('allow all on, confirm: always, and every change to the blocked list', each(ch.needsConfirm, true), [true, false, true, true, true, true]);
  t('allow all on, all of those strong', each(ch.strongConfirm, true), [true, false, true, true, true, true]);
  t('no move, no confirm', [ch.needsConfirm('blocked', 'blocked', true), ch.strongConfirm('always', 'always', true)], [false, false]);
  t('only a block goes ahead unconfirmed', ['always', 'blocked', 'none'].map(ch.goesAheadAnyway), [false, true, false]);
  t('allow all: on asks, off never', [ch.allowAllNeedsConfirm(true), ch.allowAllNeedsConfirm(false)], [true, false]);
  t('count', ch.countApps([app('a', 'always'), app('b', 'blocked'), app('c', 'blocked')]), { always: 1, blocked: 2 });
  t('count: none', ch.countApps([]), { always: 0, blocked: 0 });

  // The page's apps: how a screen reader hears one, the tally, and what a tap does.
  t('said: always', c.appSaid('Bank', 'always'), 'Bank, always allowed');
  t('said: blocked', c.appSaid('Bank', 'blocked'), 'Bank, blocked');
  t('tally: both kinds', c.tally([app('a', 'always'), app('b', 'always'), app('c', 'blocked')]), '2 always · 1 blocked');
  t('tally: one kind', [c.tally([app('a', 'always')]), c.tally([app('c', 'blocked')])], ['1 always', '1 blocked']);
  t('tally: none', c.tally([]), 'no answers yet');
  t('how to change one says tap', [c.CHANGE_HINT.startsWith('Tap an app'), c.CHANGE_HINT.includes('asked again')], [true, true]);

  // The page: A-04 at the front desk says how the door is kept, then the two
  // boxes split by kind in label order.
  t('desk: open house while allow all is on', [c.deskLine(true).startsWith('Open house'), c.deskLine(true).includes('blocked')], [true, true]);
  t('desk: off, each new app knocks first', [c.deskLine(false).includes('knocks first'), c.deskLine(false).includes('every agent')], [true, true]);
  const mixed = [app('a', 'always'), app('b', 'blocked'), app('c', 'always'), app('d', 'blocked')];
  t('split: by kind, order kept', lay.splitApps(mixed), { always: [mixed[0], mixed[2]], blocked: [mixed[1], mixed[3]] });
  t('split: none', lay.splitApps([]), { always: [], blocked: [] });
  t('boxes say where an answer lands', [c.NONE_ALWAYS.includes('Always'), c.NONE_BLOCKED.includes('No')], [true, true]);

  // The page's barcodes are real lines.
  t('barcodes', ['slipApp', 'alwaysApps', 'blockedApps', 'frontDesk'].every((id) => typeof BARCODE_LINES[id] === 'string'), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

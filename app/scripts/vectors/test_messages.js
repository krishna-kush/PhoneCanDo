// Agent messages: what native sends, as the app reads it
// (src/engine/messages/parse.ts), and how the Messages page and the rows
// around it show it: the filter to one agent, who to whom, each
// recipient's status, replies (src/ui/messages/logic/messageView.ts), the
// times, the screen queue's line and the copy (messagesCopy.ts). Imports
// the real pure modules (Node 22.18+ strips their types), so these cannot
// drift. Times read in UTC.
// Run: node test_messages.js (or pnpm check:vectors)
'use strict';
process.env.TZ = 'UTC';
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

const MIN = 60_000;
const HOUR = 60 * MIN;

(async () => {
  // --- what native sends --------------------------------------------------------
  const p = await import(src('engine/messages/parse.ts'));
  const raw = {
    id: 12,
    from: { agentId: 'b', name: 'Builder', kind: 'claude' },
    to: { kind: 'agent', agentId: 'r', name: 'Reviewer' },
    text: 'Can you check src/auth?',
    replyTo: 9,
    sentAt: 1000,
    hop: 0,
    notice: false,
    deliveries: [{ agentId: 'r', name: 'Reviewer', status: 'read', woke: true }],
  };
  t('a full message reads as sent', p.asMessage(raw), {
    id: 12,
    from: { agentId: 'b', name: 'Builder', kind: 'claude' },
    to: { kind: 'agent', agentId: 'r', name: 'Reviewer' },
    text: 'Can you check src/auth?',
    replyTo: 9,
    sentAt: 1000,
    hop: 0,
    notice: false,
    deliveries: [{ agentId: 'r', name: 'Reviewer', status: 'read', woke: true, reason: null }],
  });
  t('no id: dropped', p.asMessage({ text: 'x' }), null);
  t('not an object: dropped', p.asMessage('x'), null);
  const bare = p.asMessage({ id: 3 });
  t('missing fields take their defaults', [bare.from, bare.to, bare.text, bare.replyTo, bare.sentAt, bare.notice, bare.deliveries], [
    { agentId: null, name: '', kind: null },
    { kind: 'agent', agentId: null, name: '' },
    '',
    null,
    0,
    false,
    [],
  ]);
  t('a machine broadcast keeps its machine', p.asMessage({ id: 4, to: { kind: 'machine', imageId: 'i1', name: 'x' } }).to, { kind: 'machine', imageId: 'i1' });
  t('a phone broadcast keeps only its kind', p.asMessage({ id: 8, to: { kind: 'phone', name: 'x' } }).to, { kind: 'phone' });
  t('an unknown status reads as waiting', p.asMessage({ id: 5, deliveries: [{ agentId: 'a', status: 'lost' }] }).deliveries[0].status, 'queued');
  t('a delivery without an agent is dropped', p.asMessage({ id: 6, deliveries: [{ name: 'x' }, { agentId: 'a' }] }).deliveries.map((d) => d.name), ['a']);
  t('a refusal keeps its reason', p.asMessage({ id: 7, deliveries: [{ agentId: 'a', status: 'refused', reason: 'too many messages' }] }).deliveries[0].reason, 'too many messages');
  t('the log drops bad records and keeps the order', p.asMessageLog([{ id: 3 }, null, { id: 2 }, 'x']).map((m) => m.id), [3, 2]);
  t('a log that is no list is empty', p.asMessageLog(null), []);
  t('unread counts keep counts above zero', p.asUnreadCounts({ a: 2, b: 0, c: -1, d: 'x', e: 3.7 }), { a: 2, e: 3 });
  t('no counts: empty', p.asUnreadCounts(undefined), {});
  t('the screen queue reads as sent', p.asScreenQueue({ holder: { agentId: 'b', name: 'Builder' }, reserved: true, waiting: [{ agentId: 'r', name: 'Reviewer' }, { name: 'x' }] }), {
    holder: { agentId: 'b', name: 'Builder' },
    reserved: true,
    waiting: [{ agentId: 'r', name: 'Reviewer' }],
  });
  t('no queue: nobody', p.asScreenQueue(null), { holder: null, reserved: false, waiting: [] });
  t('reserved without a holder: not reserved', p.asScreenQueue({ holder: null, reserved: true, waiting: [] }).reserved, false);
  t('an event carries the unread counts', p.eventUnread({ unread: { a: 2, b: 0 } }), { a: 2 });
  t('an event without counts', [p.eventUnread(null), p.eventUnread({}), p.eventUnread({ unread: 3 })], [null, null, null]);
  t('an event with none unread', p.eventUnread({ unread: {} }), {});

  // --- how a message reads --------------------------------------------------------
  const v = await import(src('ui/messages/logic/messageView.ts'));
  const msg = (id, over = {}) => ({
    id,
    from: { agentId: 'b', name: 'Builder', kind: 'claude' },
    to: { kind: 'agent', agentId: 'r', name: 'Reviewer' },
    text: `message ${id}`,
    replyTo: null,
    sentAt: 0,
    hop: 0,
    notice: false,
    deliveries: [{ agentId: 'r', name: 'Reviewer', status: 'delivered', woke: false, reason: null }],
    ...over,
  });
  const toTester = msg(3, { from: { agentId: 'r', name: 'Reviewer', kind: 'gemini' }, to: { kind: 'agent', agentId: 't', name: 'Tester' }, deliveries: [{ agentId: 't', name: 'Tester', status: 'queued', woke: false, reason: null }] });
  const phone = msg(2, {
    to: { kind: 'phone' },
    deliveries: [
      { agentId: 'r', name: 'Reviewer', status: 'read', woke: false, reason: null },
      { agentId: 't', name: 'Tester', status: 'refused', woke: false, reason: 'stopped' },
    ],
  });
  const log = [toTester, phone, msg(1)];
  t('every message without a filter', v.messagesFor(log, null).map((m) => m.id), [3, 2, 1]);
  t('one agent: what it sent and what reached it', v.messagesFor(log, 'r').map((m) => m.id), [3, 2, 1]);
  t('a broadcast reaches each recipient', v.messagesFor(log, 't').map((m) => m.id), [3, 2]);
  t('the sender sees its own', v.messagesFor(log, 'b').map((m) => m.id), [2, 1]);
  t('an agent with none', v.messagesFor(log, 'x'), []);

  t('to one agent', v.routeLine(msg(1)), 'Builder → Reviewer');
  t('to its machine', v.routeLine(msg(1, { to: { kind: 'machine', imageId: 'i1' } })), 'Builder → its machine');
  t('to the whole phone', v.routeLine(phone), 'Builder → whole phone');
  t('a runner notice is from PhoneCanDo', v.routeLine(msg(1, { notice: true, from: { agentId: null, name: 'PhoneCanDo', kind: null } })), 'PhoneCanDo → Reviewer');
  t('a sender with no name', v.fromLabel(msg(1, { from: { agentId: null, name: '', kind: null } })), 'An agent');

  t('one recipient: only its status', v.deliveryLines(msg(1)).map((l) => [l.text, l.tone]), [['delivered', 'muted']]);
  const woke = msg(1, { deliveries: [{ agentId: 'r', name: 'Reviewer', status: 'read', woke: true, reason: null }] });
  t('a wake names who it woke', v.deliveryLines(woke).map((l) => [l.text, l.tone]), [['read · woke Reviewer', 'secondaryInk']]);
  t('a broadcast names each recipient', v.deliveryLines(phone).map((l) => [l.text, l.tone]), [
    ['Reviewer · read', 'secondaryInk'],
    ['Tester · refused: stopped', 'primary'],
  ]);
  t('waiting is dim', v.deliveryLines(toTester).map((l) => [l.text, l.tone]), [['waiting', 'dim']]);
  t('a refusal without a reason', v.statusText({ status: 'refused', reason: null }), 'refused');

  t('a short snippet stays whole', v.snippet('  fix   the\nbuild '), 'fix the build');
  t('a long snippet is cut with an ellipsis', v.snippet('a'.repeat(80), 10), `${'a'.repeat(9)}…`);

  const reply = msg(4, { replyTo: 3 });
  const shown = new Set([4, 3]);
  const ref = v.replyRef(reply, [reply, ...log], shown);
  t('a reply finds what it answers', [ref.id, ref.message.id, ref.shown], [3, 3, true]);
  t('the reply line quotes it', v.replyText(ref), '↩ Reviewer: “message 3”');
  const gone = v.replyRef(msg(5, { replyTo: 99 }), log, shown);
  t('a reply to a message the log let go', [gone.message, gone.shown, v.replyText(gone)], [null, false, '↩ answers an older message (#99)']);
  const hidden = v.replyRef(reply, [reply, ...log], new Set([4]));
  t('in the log but filtered out: no link', [hidden.message.id, hidden.shown], [3, false]);
  t('no reply: none', v.replyRef(msg(1), log, shown), null);
  t('unread together', v.unreadTotal({ a: 2, b: 3 }), 5);
  t('no unread', v.unreadTotal({}), 0);

  // --- copy ------------------------------------------------------------------------
  const c = await import(src('ui/messages/logic/messagesCopy.ts'));
  const now = Date.UTC(2026, 10, 12, 15, 30); // 12 Nov 2026, 15:30
  t('just now', c.messageTime(now - 20_000, now), 'just now');
  t('minutes ago', c.messageTime(now - 12 * MIN, now), '12 min ago');
  t('earlier today: the clock', c.messageTime(Date.UTC(2026, 10, 12, 9, 5), now), '09:05');
  t('yesterday', c.messageTime(Date.UTC(2026, 10, 11, 18, 40), now), 'yesterday 18:40');
  t('this year', c.messageTime(Date.UTC(2026, 10, 3, 18, 40), now), '3 Nov 18:40');
  t('another year', c.messageTime(Date.UTC(2025, 0, 3, 8, 0), now), '3 Jan 2025');
  t('no time', c.messageTime(0, now), '');
  t('an hour ago is the clock', c.messageTime(now - 2 * HOUR, now), '13:30');

  const a = (agentId, name) => ({ agentId, name });
  const sq = (holder, waiting, reserved = false) => ({ holder, reserved, waiting });
  t('nobody at the screen: no line', c.screenLine(sq(null, [])), null);
  t('a holder alone', c.screenLine(sq(a('b', 'Builder'), [])), 'Builder holds the screen');
  t('a holder and one waiting', c.screenLine(sq(a('b', 'Builder'), [a('r', 'Reviewer')])), 'Builder holds the screen · Reviewer waiting');
  t('a holder and two waiting', c.screenLine(sq(a('b', 'Builder'), [a('r', 'Reviewer'), a('t', 'Tester')])), 'Builder holds the screen · Reviewer and Tester waiting');
  t('handed over, not driving yet: its turn', c.screenLine(sq(a('r', 'Reviewer'), [], true)), "Reviewer's turn at the screen");
  t('its turn, with more in line', c.screenLine(sq(a('r', 'Reviewer'), [a('t', 'Tester')], true)), "Reviewer's turn at the screen · Tester waiting");
  t('no holder: the first in line is next', c.screenLine(sq(null, [a('r', 'Reviewer')])), 'Reviewer gets the screen next');
  t('no holder, more in line', c.screenLine(sq(null, [a('r', 'Reviewer'), a('t', 'Tester')])), 'Reviewer gets the screen next · Tester waiting');

  t('unread text', [c.unreadText(0), c.unreadText(1), c.unreadText(4)], ['', '1 unread', '4 unread']);
  t('the mark stays small', [c.unreadMark(7), c.unreadMark(120)], ['7', '99+']);
  t('unread for a screen reader', [c.unreadLabel(0), c.unreadLabel(1), c.unreadLabel(3)], ['', '1 unread message', '3 unread messages']);
  t('the switch says a stopped agent stays stopped', c.wakeSubtitle(true).includes('A stopped agent stays stopped'), true);
  t('off, messages wait', c.wakeSubtitle(false), 'Messages wait for its next turn.');
  t('empty, one agent', c.emptyText('Reviewer'), 'No messages to or from Reviewer yet.');
  t('empty, every agent', c.emptyText(null), 'No messages yet. When agents talk to each other, it shows here.');
  const copy = [c.MESSAGES_INTRO, c.WAKE_TITLE, c.wakeSubtitle(true), c.wakeSubtitle(false), c.emptyText(null)].join(' ');
  t('the copy never says the owner', /owner/i.test(copy), false);

  t('home chip: one new', c.newMessagesChip(1), '1 new msg');
  t('home chip: many, capped', [c.newMessagesChip(3), c.newMessagesChip(120)], ['3 new msgs', '99+ new msgs']);
  t('home chip label', c.newMessagesLabel(2), '2 new messages between agents. Opens Messages.');

  // --- messaging levels (src/ui/messages/logic/levels.ts) ---------------------------
  const lv = await import(src('ui/messages/logic/levels.ts'));
  t('levels best first', lv.LEVELS, ['wakes', 'delivered', 'inbox', 'none']);
  t('a level from the runner', p.levelOf('delivered'), 'delivered');
  t('an unknown level reads as none', p.levelOf('push'), 'none');
  t('kind tag', [lv.levelTag('wakes'), lv.levelTag('none')], ['Messages · wakes', 'No messages']);
  t('agent line names the kind', lv.agentLevelLine('none', 'aider').startsWith("aider can't read or send messages"), true);
  const rows = lv.levelRows(
    [{ name: 'Builder', kind: 'claude-code' }, { name: 'Pair', kind: 'aider' }, { name: 'Reviewer', kind: 'opencode' }],
    (k) => ({ 'claude-code': 'wakes', opencode: 'wakes', aider: 'none' })[k] ?? 'none',
  );
  t('explainer rows: every level, agents by level', rows.map((r) => [r.level, r.names]), [
    ['wakes', ['Builder', 'Reviewer']], ['delivered', []], ['inbox', []], ['none', ['Pair']],
  ]);
  const levelCopy = lv.LEVELS.map((l) => [lv.levelTitle(l), lv.levelMeaning(l), lv.agentLevelLine(l, 'X')].join(' ')).join(' ');
  t('level copy never says A2A or the owner', /\bA2A\b|owner/i.test(levelCopy), false);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

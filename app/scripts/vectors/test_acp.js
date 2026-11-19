// ACP mode in the app: what native sends about an agent's turn
// (src/engine/acp/parse.ts), the background run Home folds from it and the
// rows it draws (src/ui/chat/background/logic/transcript.ts), the run's
// words (logic/copy.ts), and Home's background phase and when it asks for
// the terminal back (src/ui/chat/tui/tuiPhase.ts). Imports the real pure
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_acp.js (or pnpm check:vectors)
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
  const p = await import(src('engine/acp/parse.ts'));
  const tr = await import(src('ui/chat/background/logic/transcript.ts'));
  const copy = await import(src('ui/chat/background/logic/copy.ts'));
  const { tuiPhase, wantsTerminal, SETTLE_MS } = await import(src('ui/chat/tui/tuiPhase.ts'));

  // --- what native sends ----------------------------------------------------
  t('a text item', p.asItem({ id: 'm1', type: 'text', text: 'hi' }), { type: 'text', id: 'm1', text: 'hi' });
  t('a thought without text', p.asItem({ id: 't1', type: 'thought' }), { type: 'thought', id: 't1', text: '' });
  t('a tool item, blanks as null', p.asItem({ id: 'c1', type: 'tool', title: 'Run ls', kind: '', status: 'pending' }), {
    type: 'tool', id: 'c1', title: 'Run ls', kind: null, status: 'pending',
  });
  t('a plan keeps its string entries', p.asItem({ id: 'p', type: 'plan', entries: ['a', 3, 'b'] }), { type: 'plan', id: 'p', entries: ['a', 'b'] });
  t('no id, no item', p.asItem({ type: 'text', text: 'x' }), null);
  t('an unknown type, no item', p.asItem({ id: 'x', type: 'diff' }), null);
  const options = [{ optionId: 'a1', name: 'Allow', kind: 'allow_once' }, { optionId: 'r1', kind: 'reject_once' }, { name: 'no id' }];
  t('options: bad ones dropped, a name falls back to the id', p.asOptions(options), [
    { optionId: 'a1', name: 'Allow', kind: 'allow_once' }, { optionId: 'r1', name: 'r1', kind: 'reject_once' },
  ]);
  const ask = { requestId: 'q1', title: 'Run `rm -rf build`', toolKind: 'execute', options };
  t('a permission question', p.asPermission(ask), {
    requestId: 'q1', title: 'Run `rm -rf build`', toolKind: 'execute',
    options: [{ optionId: 'a1', name: 'Allow', kind: 'allow_once' }, { optionId: 'r1', name: 'r1', kind: 'reject_once' }],
  });
  t('a question with no options is none', p.asPermission({ requestId: 'q1', options: [] }), null);
  t('a snapshot', p.asSnapshot({ chatId: 's1', busy: true, items: [{ id: 'm1', type: 'text', text: 'a' }, { nope: 1 }], permission: null }), {
    chatId: 's1', busy: true, items: [{ type: 'text', id: 'm1', text: 'a' }], permission: null,
  });
  t('no snapshot: terminal mode or none', p.asSnapshot(null), null);
  t('an empty snapshot reads as idle', p.asSnapshot({}), { chatId: null, busy: false, items: [], permission: null });
  t('an item event', p.asAcpEvent({ agentId: 'a', type: 'item', item: { id: 'm1', type: 'text', text: 'x' } }), {
    agentId: 'a', type: 'item', item: { type: 'text', id: 'm1', text: 'x' },
  });
  t('a busy event', p.asAcpEvent({ agentId: 'a', type: 'busy', busy: true }), { agentId: 'a', type: 'busy', busy: true });
  t('a turn end event', p.asAcpEvent({ agentId: 'a', type: 'turnEnd', stopReason: 'end_turn', error: null }), {
    agentId: 'a', type: 'turnEnd', end: { stopReason: 'end_turn', error: null },
  });
  t('a gone question', p.asAcpEvent({ agentId: 'a', type: 'permissionGone', requestId: 'q1' }), { agentId: 'a', type: 'permissionGone', requestId: 'q1' });
  t('an event without an agent is dropped', p.asAcpEvent({ type: 'busy', busy: true }), null);
  t('an unknown event is dropped', p.asAcpEvent({ agentId: 'a', type: 'mode' }), null);
  t('an item event with a bad item is dropped', p.asAcpEvent({ agentId: 'a', type: 'item', item: {} }), null);

  // --- the run Home folds ------------------------------------------------------
  const text = (id, s) => ({ type: 'text', id, text: s });
  const tool = (id, title, status, kind = null) => ({ type: 'tool', id, title, kind, status });
  t('a new id goes at the end', tr.withItem([text('m1', 'a')], tool('c1', 'Run ls', 'pending')).map((i) => i.id), ['m1', 'c1']);
  t('the same id grows in place', tr.withItem([text('m1', 'a'), tool('c1', 'x', null)], text('m1', 'ab')), [text('m1', 'ab'), tool('c1', 'x', null)]);
  t('a tool update keeps its title and kind', tr.withItem([tool('c1', 'Run ls', 'pending', 'execute')], tool('c1', '', 'completed')), [
    tool('c1', 'Run ls', 'completed', 'execute'),
  ]);
  t('a tool update with no status keeps the old one', tr.mergeItem(tool('c1', 'a', 'in_progress'), tool('c1', 'b', null)), tool('c1', 'b', 'in_progress'));
  const many = Array.from({ length: 5 }, (_, i) => text(`m${i}`, 'x'));
  t('past the cap the oldest go', tr.withItem(many, text('m5', 'x'), 5).map((i) => i.id), ['m1', 'm2', 'm3', 'm4', 'm5']);
  t('the runner cap is ours', tr.MAX_ITEMS, 200);

  const permission = p.asPermission(ask);
  let run = tr.runOf({ chatId: 's', busy: true, items: [text('m1', 'a')], permission: null });
  t('a run from a snapshot', run, { items: [text('m1', 'a')], permission: null, end: null });
  t('no snapshot: an empty run', tr.runOf(null), tr.EMPTY_RUN);
  run = tr.foldEvent(run, { agentId: 'a', type: 'permission', permission });
  t('a question comes', run.permission.requestId, 'q1');
  t('another question gone leaves it', tr.foldEvent(run, { agentId: 'a', type: 'permissionGone', requestId: 'q0' }).permission.requestId, 'q1');
  t('its own gone takes it', tr.foldEvent(run, { agentId: 'a', type: 'permissionGone', requestId: 'q1' }).permission, null);
  run = tr.foldEvent(run, { agentId: 'a', type: 'turnEnd', end: { stopReason: 'cancelled', error: null } });
  t('the end takes the question and says how', [run.permission, run.end], [null, { stopReason: 'cancelled', error: null }]);
  t('a new turn has no end', tr.foldEvent(run, { agentId: 'a', type: 'busy', busy: true }).end, null);
  t('idle keeps the end', tr.foldEvent(run, { agentId: 'a', type: 'busy', busy: false }).end, { stopReason: 'cancelled', error: null });
  t('an item folds in', tr.foldEvent(run, { agentId: 'a', type: 'item', item: text('m2', 'b') }).items.map((i) => i.id), ['m1', 'm2']);

  const rows = tr.rowsOf([text('m1', '  '), { type: 'thought', id: 't', text: ' hm ' }, { type: 'plan', id: 'p', entries: [] }, tool('c', 'x', null)]);
  t('rows skip what has nothing to show, trim text', rows, [{ type: 'thought', id: 't', text: 'hm' }, tool('c', 'x', null)]);
  t('rows are the newest', tr.rowsOf(many, 2).map((i) => i.id), ['m3', 'm4']);
  const items = [text('m1', 'a'), text('m2', 'b')];
  const before = tr.rowsOf(items);
  const after = tr.rowsOf([items[0], text('m2', 'bc')]);
  t('an untouched text keeps its row', after[0] === before[0], true);
  t('a grown text gets a new row', [after[1] === before[1], after[1].text], [false, 'bc']);
  t('a long text shows its end', tr.tailText('abcdef', 3), '…def');
  t('a short text stays', tr.tailText('abc', 3), 'abc');

  // --- the run's words ------------------------------------------------------------
  t('working', copy.runHeader('Qwen', true), 'Qwen is working on a task in the background.');
  t('finished', copy.runHeader('Qwen', false), 'Qwen finished. Opening it…');
  t('a plain end says nothing more', [copy.endLine(null), copy.endLine({ stopReason: 'end_turn', error: null })], [null, null]);
  t('ends said plainly', ['cancelled', 'refusal', 'max_tokens', 'max_turn_requests', 'other'].map((r) => copy.endLine({ stopReason: r, error: null })), [
    'You stopped it.', 'It refused the task.', 'It ran out of room for its answer.', 'It reached its limit of steps.', 'It stopped: other.',
  ]);
  t('an error wins', copy.endLine({ stopReason: 'end_turn', error: 'boom' }), 'It stopped with an error: boom');
  t('tool status words', ['pending', 'in_progress', 'completed', 'failed', 'weird_one', null].map(copy.toolStatusWord), [
    'waiting', 'running', 'done', 'failed', 'weird one', '',
  ]);
  t('a failed step is trouble', [copy.toolFailed('failed'), copy.toolFailed('completed')], [true, false]);
  t('what it asks to do', ['execute', 'fetch', 'think', null].map(copy.toolKindAsk), ['Run a command', 'Go online', 'Take a step', 'Take a step']);
  {
    const o = (optionId, kind) => ({ optionId, name: kind, kind });
    t(
      'answer keys: allow once leads, a no is the way back',
      [o('a', 'allow_once'), o('b', 'allow_always'), o('c', 'reject_once'), o('d', 'reject_always')].map((x) => copy.answerRole(x, 'a')),
      ['go', 'more', 'back', 'back'],
    );
  }
  t('who asks', [copy.permissionTitle('Qwen'), copy.permissionTitle('')], ['Qwen asks before it goes on', 'An agent asks before it goes on']);
  t('the step, or a stand-in', [copy.permissionStep(' Run ls '), copy.permissionStep(''), copy.permissionStep(undefined)], ['Run ls', 'A tool step', 'A tool step']);
  const opts = (...kinds) => kinds.map((kind, i) => ({ optionId: `o${i}`, name: kind, kind }));
  t('allow once leads', copy.mainOption(opts('allow_always', 'allow_once', 'reject_once')), 'o1');
  t('else the first allow', copy.mainOption(opts('reject_once', 'allow_always')), 'o1');
  t('no allow, no lead', copy.mainOption(opts('reject_once')), null);
  t('allow everything says which way it is', [copy.allowAllNote(true), copy.allowAllNote(false)], [
    'Runs every command, edit and step in the background without asking you.',
    'Asks you before each command, edit or step in the background.',
  ]);
  t('the thought toggle', [copy.thoughtLabel(false), copy.thoughtLabel(true)], ['Thinking ▸', 'Thinking ▾']);

  // --- Home's phase --------------------------------------------------------------
  const ok = { kind: 'ok' };
  const phase = (o) => tuiPhase({ start: ok, ended: false, shown: false, state: 'ready', stateError: null, ...o }).name;
  t('ready in terminal mode attaches', phase({ mode: 'terminal' }), 'attached');
  t('no mode reads as terminal', phase({}), 'attached');
  t('ready in ACP mode is the background run', phase({ mode: 'acp' }), 'background');
  t('starting and stopping in ACP mode too', [phase({ mode: 'acp', state: 'starting' }), phase({ mode: 'acp', state: 'stopping' })], ['background', 'background']);
  t('a screen that ended for the switch is not shown', phase({ mode: 'acp', ended: true }), 'background');
  t('stopped in ACP mode is stopped', phase({ mode: 'acp', state: 'stopped' }), 'stopped');
  t('a refusal for a busy turn is not a failure', phase({ start: { kind: 'busy' }, state: 'stopped' }), 'stopped');
  t('a refusal for a busy turn waits for its state', phase({ start: { kind: 'busy' }, state: undefined }), 'starting');
  t('the terminal start after the run', phase({ start: { kind: 'pending' }, state: 'starting', mode: 'terminal' }), 'starting');

  const bg = { name: 'background' };
  const wants = (o) => wantsTerminal({ phase: bg, state: 'ready', busy: false, start: ok, inFront: true, appActive: true, asked: false, ...o });
  t('a finished run asks for the terminal', wants({}), true);
  t('not while it works', wants({ busy: true }), false);
  t('not while it starts (its task comes next)', wants({ state: 'starting' }), false);
  t('not with a start in flight', wants({ start: { kind: 'pending' } }), false);
  t('after a busy refusal, yes', wants({ start: { kind: 'busy' } }), true);
  t('not with a page over Home', wants({ inFront: false }), false);
  t('not with the app away', wants({ appActive: false }), false);
  t('once', wants({ asked: true }), false);
  t('only in the background phase', wants({ phase: { name: 'attached' } }), false);
  t('the settle time', SETTLE_MS, 2000);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

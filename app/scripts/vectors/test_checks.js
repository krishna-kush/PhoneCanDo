// Capability checks in the app: what native sends about an agent's checks,
// its Check now run and each kind's level now (src/engine/checks/parse.ts),
// the What it can do page's words and its row's summary
// (src/ui/env/agent/checks/logic/copy.ts), Check now's confirm, steps and
// results (logic/run.ts), the groups and each row's line during a check
// (logic/rows.ts) and a waiting message's why line
// (src/ui/messages/logic/waitReason.ts).
// Imports the real pure modules (Node 22.18+ strips their types), so these
// cannot drift.
// Run: node test_checks.js (or pnpm check:vectors)
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
  const p = await import(src('engine/checks/parse.ts'));
  const c = await import(src('ui/env/agent/checks/logic/copy.ts'));
  const r = await import(src('ui/env/agent/checks/logic/run.ts'));
  const g = await import(src('ui/env/agent/checks/logic/rows.ts'));
  const w = await import(src('ui/messages/logic/waitReason.ts'));

  // --- what native sends ----------------------------------------------------
  t('a checked capability', p.asCapability({ id: 'tools', state: 'checked', cliVersion: '1.0.51', at: 1000 }), {
    id: 'tools', state: 'checked', cliVersion: '1.0.51', at: 1000, code: null, detail: null,
  });
  t('a failed one keeps its code and words', p.asCapability({ id: 'messages', state: 'failed', at: 5, code: 'no_hook', detail: 'none ran' }), {
    id: 'messages', state: 'failed', cliVersion: null, at: 5, code: 'no_hook', detail: 'none ran',
  });
  t('blank code and detail read as none', p.asCapability({ id: 'wake', state: 'unchecked', code: '', detail: '' }), {
    id: 'wake', state: 'unchecked', cliVersion: null, at: null, code: null, detail: null,
  });
  t('a bad time reads as never', p.asCapability({ id: 'task', state: 'checked', at: 'soon' }).at, null);
  t('an id we have no words for is dropped', p.asCapability({ id: 'teleport', state: 'checked' }), null);
  t('a state we cannot read is dropped', p.asCapability({ id: 'tools', state: 'maybe' }), null);
  t('no id, no capability', p.asCapability({ state: 'off' }), null);
  t('capabilities in our order, the first of a repeat, bad ones dropped', p.asCapabilities([
    { id: 'chat', state: 'off' }, { id: 'tools', state: 'checked' }, { id: 'tools', state: 'failed' }, null, { id: 'x', state: 'off' },
  ]).map((x) => `${x.id}:${x.state}`), ['tools:checked', 'chat:off']);
  t('no list, no capabilities', p.asCapabilities(undefined), []);
  t('a running check, part 1 of 2, reading', p.asRun({
    state: 'running', startedAt: 99, movedAt: 150, part: 1, parts: 2, partMode: 'acp', step: 'reading', reading: { read: 420, total: 1000 },
  }), {
    state: 'running', startedAt: 99, movedAt: 150, part: 1, parts: 2, partMode: 'acp', step: 'reading', reading: { read: 420, total: 1000 }, rows: [], detail: null,
  });
  t('a run from before parts: one part in its own app, moved when it started', p.asRun({ state: 'running', startedAt: 99 }), {
    state: 'running', startedAt: 99, movedAt: 99, part: 1, parts: 1, partMode: 'terminal', step: null, reading: null, rows: [], detail: null,
  });
  t('timeout from an older runner reads as stuck, with its words', p.asRun({ state: 'timeout', startedAt: 1, detail: 'took long' }), {
    state: 'stuck', startedAt: 1, movedAt: 1, part: 1, parts: 1, partMode: 'terminal', step: null, reading: null, rows: [], detail: 'took long',
  });
  t('a cancelled check', p.asRun({ state: 'cancelled', startedAt: 5, part: 2, parts: 2 }).state, 'cancelled');
  t('a step shows only while running', p.asRun({ state: 'done', startedAt: 5, step: 'working' }).step, null);
  t('a step we have no words for is none', p.asRun({ state: 'running', startedAt: 5, step: 'dreaming' }).step, null);
  t('waiting in its own app is a step', p.asRun({ state: 'running', startedAt: 5, step: 'waiting' }).step, 'waiting');
  t('a reading only with step reading', p.asRun({ state: 'running', startedAt: 5, step: 'working', reading: { read: 3 } }).reading, null);
  t('a part past its parts counts the parts up', [p.asRun({ state: 'running', part: 2, parts: 1 })].map((x) => [x.part, x.parts]), [[2, 2]]);
  t('a row being tested', p.asRunRow({ id: 'acpTools', part: 1, status: 'testing', why: 'ignored' }), {
    id: 'acpTools', part: 1, status: 'testing', why: null,
  });
  t('a skipped row keeps its why', p.asRunRow({ id: 'wake', part: 2, status: 'skipped', why: ' needs a turn ' }), {
    id: 'wake', part: 2, status: 'skipped', why: 'needs a turn',
  });
  t('an unknown row without a why', p.asRunRow({ id: 'task', part: 2, status: 'unknown' }), { id: 'task', part: 2, status: 'unknown', why: null });
  t('a row with no part is in part 1', p.asRunRow({ id: 'acp', status: 'answered' }).part, 1);
  t('a row status we cannot read is dropped', p.asRunRow({ id: 'acp', status: 'paused' }), null);
  t('a row for a capability we have no words for is dropped', p.asRunRow({ id: 'x', status: 'queued' }), null);
  t('rows in the order sent, one each, bad ones dropped', p.asRunRows([
    { id: 'tools', part: 2, status: 'queued' }, { id: 'acp', part: 1, status: 'answered' }, { id: 'tools', status: 'testing' }, 7,
  ]).map((x) => `${x.id}:${x.status}`), ['tools:queued', 'acp:answered']);
  t('a run carries its rows', p.asRun({ state: 'running', startedAt: 5, rows: [{ id: 'acp', part: 1, status: 'testing' }] }).rows, [
    { id: 'acp', part: 1, status: 'testing', why: null },
  ]);
  t('a reading without a total', p.asReading({ read: 1234 }), { read: 1234, total: null });
  t('a total under what was read is dropped', p.asReading({ read: 50, total: 10 }), { read: 50, total: null });
  t('nothing read yet is 0', p.asReading({ read: 0, total: 900 }), { read: 0, total: 900 });
  t('no count, no reading', p.asReading({ total: 9 }), null);
  t('no run', p.asRun(null), null);
  t('a run we cannot read is none', p.asRun({ state: 'paused' }), null);
  t('an agent\'s checks', p.asAgentChecks({
    capabilities: [{ id: 'tools', state: 'checked' }], levelNow: 'inbox', run: null, checkNow: true, checkNowWhy: 'ignored',
  }), {
    capabilities: [{ id: 'tools', state: 'checked', cliVersion: null, at: null, code: null, detail: null }],
    levelNow: 'inbox', run: null, checkNow: true, checkNowWhy: null, parts: 1, rest: null, checkModel: false,
  });
  t('on the check model', p.asAgentChecks({ checkNow: true, checkModel: true }).checkModel, true);
  t('no check model when it can\'t check', p.asAgentChecks({ checkNow: false, checkModel: true }).checkModel, false);
  t('a kind that can\'t start with a task says why', p.asAgentChecks({ checkNow: false, checkNowWhy: 'It can\'t start with a task.', parts: 2 }), {
    capabilities: [], levelNow: 'none', run: null, checkNow: false, checkNowWhy: 'It can\'t start with a task.', parts: 0, rest: null, checkModel: false,
  });
  t('two parts', p.asAgentChecks({ checkNow: true, parts: 2 }).parts, 2);
  t('what Check the rest would test: ids we know, once', p.asAgentChecks({ checkNow: true, rest: { parts: 2, ids: ['wake', 'odd', 'chat', 'wake', 3] } }).rest,
    { parts: 2, ids: ['wake', 'chat'] });
  t('nothing left for Check the rest', p.asAgentChecks({ checkNow: true, rest: null }).rest, null);
  t('a rest with no id we know is none', p.asAgentChecks({ checkNow: true, rest: { parts: 1, ids: ['odd'] } }).rest, null);
  t('an unknown agent or an old build reads as none', p.asAgentChecks(null), null);
  t('kind levels: bad ones left out', p.asKindLevels({ opencode: 'wakes', pi: 'inbox', odd: 'loud', n: 3 }), { opencode: 'wakes', pi: 'inbox' });
  t('no kind levels', p.asKindLevels(undefined), {});
  t('Check now started', p.asCheckNowResult(null), null);
  t('Check now refused, in the runner\'s words', p.asCheckNowResult('Its install is running.'), 'Its install is running.');
  t('Check now refused without words gets ours', p.asCheckNowResult(''), "Couldn't start the check.");
  t('a change event', p.asChecksChange({ agentId: 'a1' }), { agentId: 'a1' });
  t('a change with no agent means any', p.asChecksChange({}), { agentId: null });

  // --- the page's words -----------------------------------------------------
  const now = 10_000_000;
  t('every capability has a label', c.capabilityLabel('acpMessages'), 'Messages during ACP turns');
  t('checked with a version and when', c.stateLine({ state: 'checked', cliVersion: '1.0.51', at: now - 12 * 60_000, detail: null }, now),
    'Checked with 1.0.51 · 12 min ago');
  t('checked, no version', c.stateLine({ state: 'checked', cliVersion: '', at: now - 1000, detail: null }, now), 'Checked · just now');
  t('checked, no time', c.stateLine({ state: 'checked', cliVersion: '2.1', at: null, detail: null }, now), 'Checked with 2.1');
  t('not checked yet', c.stateLine({ state: 'unchecked', cliVersion: null, at: null, detail: null }, now),
    'Not checked yet: used as set up, checked the first time it runs.');
  t('not working says why', c.stateLine({ state: 'failed', cliVersion: null, at: 1, detail: 'Its hooks never ran.' }, now),
    'Not working: Its hooks never ran.');
  t('off', c.stateLine({ state: 'off', cliVersion: null, at: null, detail: null }, now), 'Off: not set up for this agent.');
  t('a failure is red', c.stateTone('failed'), 'primary');
  const caps = (...states) => states.map((state, i) => ({ id: `c${i}`, state }));
  t('summary: checked and not working', c.checksSummary({ capabilities: caps('checked', 'checked', 'checked', 'checked', 'failed', 'off'), run: null }),
    { text: '4 checked · 1 not working', alert: true });
  t('summary: not checked shows with no failure', c.checksSummary({ capabilities: caps('checked', 'checked', 'unchecked', 'unchecked', 'unchecked'), run: null }),
    { text: '2 checked · 3 not checked', alert: false });
  t('summary: not checked gives way to a failure', c.checksSummary({ capabilities: caps('checked', 'failed', 'unchecked'), run: null }),
    { text: '1 checked · 1 not working', alert: true });
  t('summary: only a failure and not checked', c.checksSummary({ capabilities: caps('failed', 'unchecked'), run: null }),
    { text: '1 not working · 1 not checked', alert: true });
  t('summary: all off', c.checksSummary({ capabilities: caps('off', 'off'), run: null }), { text: 'nothing set up', alert: false });
  t('summary: while Check now runs', c.checksSummary({ capabilities: caps('failed'), run: { state: 'running', startedAt: 1, detail: null } }),
    { text: 'checking now', alert: true });

  // --- Check now ------------------------------------------------------------
  t('the confirm, one part, its own model', r.checkNowMessage('Builder', 1, false),
    'Check now restarts Builder in a new chat with a short test. It asks Builder\'s own model. You can cancel it.');
  t('the confirm, two parts, the check model', r.checkNowMessage('Builder', 2, true),
    'Check now restarts Builder with a short test: first in ACP mode, then in its own app on the same chat. It stops each part as soon as it has its answers. It runs on our check model, which answers at once, so your own model isn\'t asked. You can cancel it.');
  t('the head while it runs', r.checkingLine('Builder'), 'Checking Builder');
  const capsOf = (...states) => states.map((state, i) => ({ id: ['tools', 'wake', 'chat'][i], state, cliVersion: null, at: null, code: null, detail: null }));
  t('nothing checked yet: Check now checks everything', r.checkChoices({ capabilities: capsOf('unchecked', 'failed'), rest: { parts: 1, ids: ['tools', 'wake'] } }),
    { rest: false, all: 'Check now' });
  t('some checked: Check the rest and Check all again', r.checkChoices({ capabilities: capsOf('checked', 'unchecked'), rest: { parts: 1, ids: ['wake'] } }),
    { rest: true, all: 'Check all again' });
  t('all checked: only Check all again', r.checkChoices({ capabilities: capsOf('checked', 'checked'), rest: null }),
    { rest: false, all: 'Check all again' });
  t('the rest, one part', r.checkRestMessage('Builder', { parts: 1, ids: ['wake'] }, false),
    'Check the rest restarts Builder in a new chat to check only what isn\'t checked yet: woken while idle. It stops as soon as it has its answers. It asks Builder\'s own model. You can cancel it.');
  t('an acronym keeps its capitals', r.checkRestMessage('B', { parts: 1, ids: ['acp'] }, true),
    'Check the rest restarts B in a new chat to check only what isn\'t checked yet: ACP mode. It stops as soon as it has its answers. It runs on our check model, which answers at once, so your own model isn\'t asked. You can cancel it.');
  t('the rest, two parts', r.checkRestMessage('Builder', { parts: 2, ids: ['wake', 'tools', 'chat'] }, true),
    'Check the rest restarts Builder to check only what isn\'t checked yet: woken while idle, phone tools and opens the ACP chat after. It runs first in ACP mode, then in its own app on the same chat, and stops as soon as it has its answers. It runs on our check model, which answers at once, so your own model isn\'t asked. You can cancel it.');
  t('it may need you', r.needsYou('waiting', 'Builder'), {
    title: 'Builder may need you',
    message: 'Nothing has moved in Builder for a minute. It may be asking you something in its own app, like a sign-in, a folder to trust or a permission. Open it and answer there. The check goes on by itself.',
    open: 'Open Builder',
  });
  t('a question of its', r.needsYou('answer', 'Builder').title, 'Builder has a question');
  t('Home while it runs', r.homeBar({ state: 'running' }, 'Builder'), { text: 'Checking Builder', action: 'Back to the check' });
  t('Home once it is done', r.homeBar({ state: 'done' }, 'Builder'), { text: 'Check done', action: 'See results' });
  t('Home once it got stuck', r.homeBar({ state: 'stuck' }, 'Builder').text, 'Check stuck');
  t('no bar for a check you cancelled', r.homeBar({ state: 'cancelled' }, 'Builder'), null);
  const runOf = (state, startedAt) => ({ state, startedAt });
  t('Home names no agent while no check runs',
    r.homeCheckAgent([{ agentId: 'a', run: null }, { agentId: 'b', run: runOf('done', 5) }], 'a'), null);
  t('Home names another agent whose check runs',
    r.homeCheckAgent([{ agentId: 'a', run: null }, { agentId: 'b', run: runOf('running', 5) }], 'a'), 'b');
  t('Home names the active agent first',
    r.homeCheckAgent([{ agentId: 'b', run: runOf('running', 9) }, { agentId: 'a', run: runOf('running', 1) }], 'a'), 'a');
  t('else the check started last',
    r.homeCheckAgent([{ agentId: 'b', run: runOf('running', 3) }, { agentId: 'c', run: runOf('running', 7) }], 'a'), 'c');
  t('starting', r.stepView({ step: 'starting', reading: null }, 'Builder'), { text: 'starting Builder', progress: null, openAgent: false });
  t('reading with a total', r.stepView({ step: 'reading', reading: { read: 420, total: 1000 } }, 'B'), {
    text: 'reading the task · 42%', progress: 0.42, openAgent: false,
  });
  t('reading rounds down', r.stepView({ step: 'reading', reading: { read: 999, total: 1000 } }, 'B').text, 'reading the task · 99%');
  t('reading without a total counts tokens', r.stepView({ step: 'reading', reading: { read: 1234, total: null } }, 'B'), {
    text: 'reading the task · 1,234 tokens read', progress: null, openAgent: false,
  });
  t('one token', r.stepView({ step: 'reading', reading: { read: 1, total: null } }, 'B').text, 'reading the task · 1 token read');
  t('reading, no count yet', r.stepView({ step: 'reading', reading: null }, 'B').text, 'reading the task');
  t('a question waits', r.stepView({ step: 'answer', reading: null }, 'B'), { text: 'waiting for your answer', progress: null, openAgent: true });
  t('it may be asking you something in its own app', r.stepView({ step: 'waiting', reading: null }, 'B'), {
    text: 'waiting: it may be asking you something in its own app', progress: null, openAgent: true,
  });
  t('working', r.stepView({ step: 'working', reading: null }, 'B').text, 'working on the task');
  t('checking', r.stepView({ step: 'checking', reading: null }, 'B').text, 'checking what it did');
  t('no step, no line', r.stepView({ step: null, reading: null }, 'B'), null);
  t('the step on its own line (no rows)', r.stepLine(r.stepView({ step: 'reading', reading: { read: 42, total: 100 } }, 'B')), 'Reading the task · 42%');
  t('the link', r.openAgentLabel('Builder'), 'Open Builder');
  t('digits grouped', r.groupDigits(1234567), '1,234,567');
  t('moved just now', r.movedLine({ movedAt: now - 400 }, now), 'Last moved just now');
  t('moved in seconds', r.movedLine({ movedAt: now - 20_000 }, now), 'Last moved 20 s ago');
  t('moved in minutes and seconds', r.movedLine({ movedAt: now - 125_000 }, now), 'Last moved 2 min 5 s ago');
  t('moved in whole minutes', r.movedLine({ movedAt: now - 180_000 }, now), 'Last moved 3 min ago');
  t('no time, no moved line', r.movedLine({ movedAt: 0 }, now), null);
  const ended = (state, detail = null) => ({ state, startedAt: now - 5 * 60_000, movedAt: 0, part: 1, parts: 1, partMode: 'acp', step: null, reading: null, rows: [], detail });
  t('no result while running', r.resultLines(ended('running'), now), null);
  t('done', r.resultLines(ended('done'), now), {
    head: 'Last check · 5 min ago · done', detail: 'The rows above show what we saw. A thing the task never used stays not checked.', tone: 'muted',
  });
  t('stuck, in the runner\'s words', r.resultLines(ended('stuck', 'Nothing moved for 3 minutes (reading the task).'), now), {
    head: 'Last check · 5 min ago · stuck', detail: 'Nothing moved for 3 minutes (reading the task).', tone: 'primary',
  });
  t('stuck without words gets ours', r.resultLines(ended('stuck'), now).detail, 'Nothing moved for 3 minutes, so we stopped it to free memory.');
  t('cancelled', r.resultLines(ended('cancelled'), now), { head: 'Last check · 5 min ago · cancelled', detail: 'You cancelled it.', tone: 'muted' });
  t('a failed check without words or a time gets ours', r.resultLines({ ...ended('failed'), startedAt: 0 }, now), {
    head: 'Last check · failed', detail: 'It stopped before the check task finished.', tone: 'primary',
  });

  // --- the groups and each row's line during a check ------------------------
  const cap = (id, state, extra = {}) => ({ id, state, cliVersion: null, at: null, code: null, detail: null, ...extra });
  const all = [
    cap('tools', 'checked'), cap('messages', 'unchecked'), cap('wake', 'off'), cap('task', 'unchecked'), cap('state', 'off'),
    cap('acp', 'unchecked'), cap('acpTools', 'unchecked'), cap('acpMessages', 'off'), cap('chat', 'unchecked'),
  ];
  t('groups: ACP mode first, each in its own order', g.checkGroups(all).map((x) => [x.title, x.checks.map((c) => c.id)]), [
    ['In ACP mode', ['acp', 'acpTools', 'acpMessages']],
    ['In its own app', ['tools', 'messages', 'wake', 'task', 'chat', 'state']],
  ]);
  t('a group with nothing set up is left out', g.checkGroups([cap('tools', 'checked'), cap('acp', 'off'), cap('acpTools', 'off')]).map((x) => x.id), ['app']);
  t('no capabilities, no groups', g.checkGroups([]), []);
  const going = (rows, extra = {}) => ({
    state: 'running', startedAt: now - 60_000, movedAt: now - 2000, part: 1, parts: 2, partMode: 'acp',
    step: 'reading', reading: { read: 300, total: 1000 }, rows, detail: null, ...extra,
  });
  const run = going([
    { id: 'acp', part: 1, status: 'answered', why: null },
    { id: 'acpTools', part: 1, status: 'testing', why: null },
    { id: 'tools', part: 2, status: 'queued', why: null },
    { id: 'wake', part: 2, status: 'skipped', why: 'needs a turn in its own app; checked the first time you use it' },
    { id: 'task', part: 2, status: 'unknown', why: "Couldn't tell: its turn didn't end" },
  ]);
  t('testing: the step and its bar', g.rowLine(cap('acpTools', 'unchecked'), run, 'Builder', now), {
    text: 'Testing now · reading the task · 30%', tone: 'secondaryInk', progress: 0.3,
  });
  t('testing, no step yet', g.rowLine(cap('acpTools', 'unchecked'), { ...run, step: null, reading: null }, 'Builder', now), {
    text: 'Testing now', tone: 'secondaryInk', progress: null,
  });
  t('queued behind ACP mode', g.rowLine(cap('tools', 'checked'), run, 'Builder', now), { text: 'Queued · after ACP mode', tone: 'dim', progress: null });
  t('queued in its own app\'s part', g.rowLine(cap('tools', 'checked'), { ...run, partMode: 'terminal', part: 2 }, 'Builder', now).text, 'Queued');
  t('answered: its state line', g.rowLine(cap('acp', 'checked', { cliVersion: '2.0', at: now - 1000 }), run, 'Builder', now), {
    text: 'Checked with 2.0 · just now', tone: 'secondaryInk', progress: null,
  });
  t('answered and failing: its state line', g.rowLine(cap('acp', 'failed', { detail: 'It quit.' }), run, 'Builder', now).text, 'Not working: It quit.');
  t('skipped says why', g.rowLine(cap('wake', 'unchecked'), run, 'Builder', now), {
    text: 'Skipped: needs a turn in its own app; checked the first time you use it', tone: 'dim', progress: null,
  });
  t('a capitalised why reads on in lower case', g.rowLine(cap('wake', 'unchecked'), going([{ id: 'wake', part: 2, status: 'skipped', why: 'Needs a turn in its own app; checked the first time you use it.' }]), 'B', now).text,
    'Skipped: needs a turn in its own app; checked the first time you use it.');
  t('skipped in the runner\'s own words', g.rowLine(cap('wake', 'unchecked'), going([{ id: 'wake', part: 2, status: 'skipped', why: 'Skipped for now' }]), 'B', now).text,
    'Skipped for now');
  t('unknown says why', g.rowLine(cap('task', 'unchecked'), run, 'Builder', now), { text: "Couldn't tell: its turn didn't end", tone: 'muted', progress: null });
  t('unknown without words gets ours', g.rowLine(cap('task', 'unchecked'), going([{ id: 'task', part: 2, status: 'unknown', why: null }]), 'B', now).text,
    "Couldn't tell from this turn");
  t('not in the check: its state line', g.rowLine(cap('messages', 'unchecked'), run, 'Builder', now).text,
    'Not checked yet: used as set up, checked the first time it runs.');
  const after = { ...run, state: 'done', step: null, reading: null };
  t('after the run: unknown stays', g.rowLine(cap('task', 'unchecked'), after, 'Builder', now).text, "Couldn't tell: its turn didn't end");
  t('after the run: skipped stays', g.rowLine(cap('wake', 'unchecked'), after, 'Builder', now).text,
    'Skipped: needs a turn in its own app; checked the first time you use it');
  t('after the run: a row left queued shows its state', g.rowLine(cap('tools', 'checked'), { ...after, state: 'cancelled' }, 'Builder', now).text, 'Checked');
  t('no run: its state line', g.rowLine(cap('tools', 'off'), null, 'Builder', now), { text: 'Off: not set up for this agent.', tone: 'faint', progress: null });
  t('a run with rows', g.runHasRows(run), true);
  t('a run from before rows', g.runHasRows(going([])), false);
  t('no run, no rows', g.runHasRows(null), false);

  // --- why a message waits --------------------------------------------------
  const failedHooks = { state: 'failed', code: 'no_hook' };
  t('waiting, hooks failed', w.waitReason({ name: 'Reviewer', status: 'queued' }, failedHooks),
    "Reviewer's message hooks didn't run in its last turn, so this waits until it checks its inbox.");
  t('waiting, its server said no', w.waitReason({ name: 'Reviewer', status: 'queued' }, { state: 'failed', code: 'http_503' }),
    "Reviewer's server turned the last message away (error 503), so this waits.");
  t('waiting, another failure', w.waitReason({ name: 'Reviewer', status: 'queued' }, { state: 'failed', code: null }),
    "Messages during Reviewer's turns aren't working, so this waits until it checks its inbox.");
  t('read: no line', w.waitReason({ name: 'Reviewer', status: 'read' }, failedHooks), null);
  t('waiting, messages checked: no line', w.waitReason({ name: 'Reviewer', status: 'queued' }, { state: 'checked', code: null }), null);
  t('waiting, not read yet: no line', w.waitReason({ name: 'Reviewer', status: 'queued' }, undefined), null);
  const message = {
    deliveries: [
      { agentId: 'a1', name: 'Reviewer', status: 'queued' },
      { agentId: 'a2', name: 'Tester', status: 'queued' },
      { agentId: 'a3', name: 'Writer', status: 'delivered' },
    ],
  };
  t('the agents it waits for', w.waitingAgents(message), ['a1', 'a2']);
  t('a line for each waiting agent whose messages failed', w.waitReasonLines(message, {
    a1: { capabilities: [{ id: 'tools', state: 'checked' }, { id: 'messages', ...failedHooks }] },
    a2: { capabilities: [{ id: 'messages', state: 'checked' }] },
    a3: { capabilities: [{ id: 'messages', ...failedHooks }] },
  }), [{ key: 'a1', text: "Reviewer's message hooks didn't run in its last turn, so this waits until it checks its inbox." }]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

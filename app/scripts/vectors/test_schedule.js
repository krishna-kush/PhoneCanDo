// Schedules: what native sends, as the app reads it
// (src/engine/schedule/parse.ts), and how the Schedules page and its
// editor show and build it: clock times and days (logic/clock.ts), the
// timing and next run in words (logic/timingText.ts), the copy
// (logic/scheduleCopy.ts), the editor's form, problems and what it saves
// (logic/draft.ts), the one-tap times (logic/presets.ts), and the timeline
// across agents (logic/timeline.ts). Imports
// the real pure modules (Node 22.18+ strips their types), so these cannot
// drift. Times read in UTC.
// Run: node test_schedule.js (or pnpm check:vectors)
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
const DAY = 24 * HOUR;
// Friday 13 Nov 2026, 10:20 UTC.
const NOW = Date.UTC(2026, 10, 13, 10, 20);
const at = (d, h, m) => Date.UTC(2026, 10, d, h, m);

(async () => {
  // --- what native sends --------------------------------------------------------
  const p = await import(src('engine/schedule/parse.ts'));
  const raw = {
    id: 's0123456789',
    agentId: 'a1',
    text: 'Check the build',
    timing: { type: 'daily', time: '09:00', days: ['fri', 'mon', 'xyz', 'mon'] },
    chat: 'new',
    on: true,
    by: 'agent',
    createdAt: 1000,
    nextAt: at(16, 9, 0),
    lastRun: { at: 5000, outcome: 'woke' },
  };
  t('a full schedule reads as sent (days ordered, deduped, unknown dropped)', p.asSchedule(raw), {
    id: 's0123456789',
    agentId: 'a1',
    text: 'Check the build',
    timing: { type: 'daily', time: '09:00', days: ['mon', 'fri'] },
    chat: 'new',
    on: true,
    by: 'agent',
    createdAt: 1000,
    nextAt: at(16, 9, 0),
    lastRun: { at: 5000, outcome: 'woke', detail: null },
  });
  t('no id: dropped', p.asSchedule({ ...raw, id: undefined }), null);
  t('no agent: dropped', p.asSchedule({ ...raw, agentId: 3 }), null);
  t('a timing we cannot read: dropped', p.asSchedule({ ...raw, timing: { type: 'cron', spec: '* * *' } }), null);
  t('a bad daily time: dropped', p.asSchedule({ ...raw, timing: { type: 'daily', time: '24:00', days: [] } }), null);
  const bare = p.asSchedule({ id: 's1', agentId: 'a', timing: { type: 'once', at: 7 } });
  t('missing fields take their defaults (a one-off: same chat)', [bare.text, bare.chat, bare.on, bare.by, bare.createdAt, bare.nextAt, bare.lastRun], [
    '',
    'same',
    true,
    'user',
    0,
    null,
    null,
  ]);
  t('a repeating one without chat: new chat', p.asSchedule({ id: 's2', agentId: 'a', timing: { type: 'every', minutes: 30 } }).chat, 'new');
  t('every: whole minutes, anchor 0 when missing', p.asTiming({ type: 'every', minutes: 30.7 }), { type: 'every', minutes: 30, anchor: 0 });
  t('every: under a minute is no timing', p.asTiming({ type: 'every', minutes: 0, anchor: 1 }), null);
  t('on: false only when sent false', p.asSchedule({ ...raw, on: false }).on, false);
  t('a last run with an outcome we do not know: none', p.asSchedule({ ...raw, lastRun: { at: 1, outcome: 'exploded' } }).lastRun, null);
  t('a list drops the bad ones', p.asSchedules([raw, null, 'x', { id: 'no' }]).map((s) => s.id), ['s0123456789']);
  t('not a list: empty', p.asSchedules({ id: 's' }), []);

  const run = {
    seq: 4,
    scheduleId: 's1',
    agentId: 'a1',
    agentName: 'Builder',
    text: 'Check',
    by: 'user',
    dueAt: 100,
    firedAt: 200,
    late: true,
    outcome: 'failed',
    detail: 'start failed',
  };
  t('a run reads as sent', p.asRun(run), run);
  t('a run without detail: null', p.asRun({ ...run, detail: undefined }).detail, null);
  t('a run without a name: its agent id', p.asRun({ ...run, agentName: '' }).agentName, 'a1');
  t('a run with an outcome we do not know: dropped', p.asRun({ ...run, outcome: 'x' }), null);
  t('a run without seq: dropped', p.asRun({ ...run, seq: 'four' }), null);
  t('runs keep their order', p.asRuns([run, { ...run, seq: 3, outcome: 'busy' }, 7]).map((r) => r.seq), [4, 3]);

  t('result ok', p.asResult({ ok: true, schedule: raw }, 'x').ok, true);
  t('result ok with an unreadable schedule: null schedule', p.asResult({ ok: true, schedule: {} }, 'x'), { ok: true, schedule: null });
  t('result refused', p.asResult({ ok: false, reason: 'limit' }, 'x'), { ok: false, reason: 'limit' });
  t('result garbage: refused with the fallback', p.asResult(undefined, "Couldn't add it."), { ok: false, reason: "Couldn't add it." });
  t('run now ok', p.asRunNow({ ok: true }, 'x'), { ok: true });
  t('run now refused, no reason: fallback', p.asRunNow({ ok: false }, 'nope'), { ok: false, reason: 'nope' });
  t('exact alarms: as sent', [p.asExact({ exact: true }), p.asExact({ exact: false })], [true, false]);
  t('exact alarms: nothing sent is unknown', [p.asExact(undefined), p.asExact({})], [null, null]);

  // --- clock ----------------------------------------------------------------------
  const c = await import(src('ui/schedule/logic/clock.ts'));
  t('hhmm', c.hhmm(at(13, 9, 5)), '09:05');
  t('start of day', c.startOfDay(NOW), at(13, 0, 0));
  t('add days crosses the month', c.addDays(NOW, 20), Date.UTC(2026, 11, 3));
  t('days from now', [c.daysFrom(NOW, at(13, 23, 59)), c.daysFrom(NOW, at(14, 0, 1)), c.daysFrom(NOW, at(12, 23, 0))], [0, 1, -1]);
  t('weekday of', [c.weekdayOf(NOW), c.weekdayOf(at(15, 12, 0)), c.weekdayOf(at(16, 0, 0))], ['fri', 'sun', 'mon']);
  t('date text this year', c.dateText(at(21, 9, 0), NOW), 'Sat 21 Nov');
  t('date text another year', c.dateText(Date.UTC(2027, 0, 4, 9), NOW), 'Mon 4 Jan 2027');
  t('day labels', [c.dayLabel(at(13, 0, 0), NOW), c.dayLabel(at(14, 0, 0), NOW), c.dayLabel(at(15, 0, 0), NOW)], [
    'Today',
    'Tomorrow',
    'Sun 15 Nov',
  ]);
  t(
    'typed times',
    ['9', '9:30', '9.30', '930', '0930', '21:05', ' 7 : 05 ', '2359'].map(c.parseClock),
    ['09:00', '09:30', '09:30', '09:30', '09:30', '21:05', '07:05', '23:59'],
  );
  t('times that are not', ['24:00', '9:60', '12345', 'nine', '', '9:5'].map(c.parseClock), [null, null, null, null, null, null]);
  t('a day at a time', c.atDayTime(at(14, 0, 0), '18:45'), at(14, 18, 45));
  t('next whole hour', [c.nextWholeHour(NOW), c.nextWholeHour(at(13, 23, 0))], [at(13, 11, 0), at(14, 0, 0)]);

  // --- timing in words --------------------------------------------------------------
  const w = await import(src('ui/schedule/logic/timingText.ts'));
  t(
    'every',
    [15, 90, 60, 360, 1440, 2880].map(w.everyText),
    ['every 15 min', 'every 90 min', 'every hour', 'every 6 hours', 'every day', 'every 2 days'],
  );
  t(
    'days',
    [[], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], ['mon', 'tue', 'wed', 'thu', 'fri'], ['sun', 'sat'], ['fri', 'mon', 'wed']].map(w.daysText),
    ['daily', 'daily', 'weekdays', 'weekends', 'Mon, Wed, Fri'],
  );
  t(
    'day and time',
    [at(13, 14, 30), at(14, 9, 0), at(12, 9, 0), at(17, 9, 0), at(25, 9, 0)].map((ms) => w.dayTimeText(ms, NOW)),
    ['today 14:30', 'tomorrow 09:00', 'yesterday 09:00', 'Tue 09:00', 'Wed 25 Nov 09:00'],
  );
  t(
    'timings',
    [
      { type: 'once', at: at(14, 9, 0) },
      { type: 'every', minutes: 30, anchor: 0 },
      { type: 'daily', time: '09:00', days: [] },
      { type: 'daily', time: '08:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
      { type: 'daily', time: '18:00', days: ['thu', 'mon'] },
    ].map((x) => w.timingText(x, NOW)),
    ['once, tomorrow 09:00', 'every 30 min', 'daily at 09:00', 'weekdays at 08:30', 'Mon, Thu at 18:00'],
  );
  t(
    'how far off',
    [NOW + 30_000, NOW + 12 * MIN + 59_000, NOW + 2 * HOUR].map((ms) => w.whenText(ms, NOW)),
    ['in under a minute', 'in 12 min', 'today 12:20'],
  );
  const once = { type: 'once', at: 0 };
  const every = { type: 'every', minutes: 30, anchor: 0 };
  t(
    'next run',
    [
      { on: false, nextAt: NOW + HOUR, timing: every },
      { on: true, nextAt: null, timing: once },
      { on: true, nextAt: null, timing: every },
      { on: true, nextAt: at(13, 9, 0), timing: every },
      { on: true, nextAt: NOW + 5 * MIN, timing: every },
      { on: true, nextAt: at(14, 9, 0), timing: every },
    ].map((s) => w.nextRunText(s, NOW)),
    ['off', 'done', 'no next run', 'due since 09:00', 'next in 5 min', 'next tomorrow 09:00'],
  );

  // --- copy -----------------------------------------------------------------------
  const k = await import(src('ui/schedule/logic/scheduleCopy.ts'));
  t(
    'outcomes in words',
    ['started', 'woke', 'restarted', 'asked', 'busy', 'missed', 'failed'].map((o) => k.outcomeText(o, null)),
    ['started', 'woke', 'restarted', 'asked you', 'skipped: busy', 'missed', 'failed'],
  );
  t('failed with why', k.outcomeText('failed', 'agent gone'), 'failed: agent gone');
  t('another with a detail', k.outcomeText('asked', 'app in front'), 'asked you · app in front');
  t('tones', ['woke', 'failed', 'missed'].map(k.outcomeTone), ['secondaryInk', 'primary', 'dim']);
  t('last run line', k.lastRunText({ at: NOW - 12 * MIN, outcome: 'woke', detail: null }, NOW), 'last: woke · 12 min ago');
  const r = { ...run, firedAt: at(13, 9, 5), agentName: 'Builder', late: true };
  t('run head with the agent', k.runHead(r, NOW, true), '09:05 · Builder · late');
  t('run head on one agent, on time', k.runHead({ ...r, late: false }, NOW, false), '09:05');
  t('by', [k.byText('user'), k.byText('agent')], ['by you', 'by the agent']);
  t('counts', [0, 1, 3].map(k.countText), ['', '1 schedule', '3 schedules']);
  t('empty', [k.emptyText(null), k.emptyText('Builder')], ['No schedules yet.', 'No schedules for Builder yet.']);
  t('chat words', [k.chatLabel('new'), k.chatLabel('same')], ['New chat', 'Same chat']);
  t('reasons: known codes in words, others as said', [k.reasonText('limit'), k.reasonText('The text is empty.')], [
    'That agent has as many schedules as it can have.',
    'The text is empty.',
  ]);
  t('cannot run', k.cannotRunText('Gemini CLI'), "Gemini CLI can't run schedules.");

  // --- the editor -----------------------------------------------------------------
  const d = await import(src('ui/schedule/logic/draft.ts'));
  const fresh = d.newDraft('a1', NOW);
  t('a new one: once, next whole hour, today, same chat', [fresh.when, fresh.day, fresh.time, fresh.chat, fresh.chatPicked], [
    'once',
    at(13, 0, 0),
    '11:00',
    'same',
    false,
  ]);
  t('late in the day: the next hour is tomorrow', d.newDraft(null, at(13, 23, 30)).day, at(14, 0, 0));
  t('a change of when moves the chat', [d.withWhen(fresh, 'every').chat, d.withWhen(fresh, 'daily').chat], ['new', 'new']);
  const picked = d.withChat(fresh, 'same');
  t('a picked chat stays', d.withWhen(picked, 'every').chat, 'same');
  t('days toggle', d.toggleDay(d.toggleDay(fresh, 'mon'), 'fri').days, ['mon', 'fri']);
  t('a day toggled twice goes', d.toggleDay(d.toggleDay(fresh, 'mon'), 'mon').days, []);
  t('day steps stop at today', d.stepDay(fresh, -3, NOW).day, at(13, 0, 0));
  t('day steps go forward', d.stepDay(fresh, 2, NOW).day, at(15, 0, 0));
  t('day steps stop a year ahead', d.stepDay(fresh, 400, NOW).day, c.addDays(NOW, 366));
  t('interval', [d.everyMinutes({ every: '2', unit: 'hours' }), d.everyMinutes({ every: ' 45 ', unit: 'min' }), d.everyMinutes({ every: '1.5', unit: 'hours' })], [
    120,
    45,
    null,
  ]);

  const fields = (x) => d.draftProblems(x, NOW).map((pr) => pr.field);
  t('a fresh one for an agent wants only the task', fields(fresh), ['text']);
  t('no agent, no task', fields(d.newDraft(null, NOW)), ['agent', 'text']);
  const ok = { ...fresh, text: '  Check the build  ' };
  t('a good one-off has no problems', fields(ok), []);
  t('a past time', d.draftProblems({ ...ok, time: '10:00' }, NOW), [{ field: 'time', text: 'That time has passed.' }]);
  t('a time that is not one', fields({ ...ok, time: 'soon' }), ['time']);
  t('too long', fields({ ...ok, text: 'x'.repeat(4001) }), ['text']);
  t('every 10 min is too often', d.draftProblems({ ...d.withWhen(ok, 'every'), every: '10', unit: 'min' }, NOW), [
    { field: 'every', text: 'At least every 15 minutes.' },
  ]);
  t('every 15 min is fine', fields({ ...d.withWhen(ok, 'every'), every: '15', unit: 'min' }), []);
  t('every half an hour typed as 0.5 is no number', fields({ ...d.withWhen(ok, 'every'), every: '0.5' }), ['every']);
  t('a daily one ignores the day', fields({ ...d.withWhen(ok, 'daily'), time: '07:00' }), []);

  t('the spec of a one-off', d.specOf(ok, NOW), {
    agentId: 'a1',
    text: 'Check the build',
    timing: { type: 'once', at: at(13, 11, 0) },
    chat: 'same',
  });
  t('the spec of a repeating one counts from now', d.specOf({ ...d.withWhen(ok, 'every'), every: '2' }, NOW), {
    agentId: 'a1',
    text: 'Check the build',
    timing: { type: 'every', minutes: 120, anchor: NOW },
    chat: 'new',
  });
  t('the spec of a daily one', d.specOf({ ...d.withWhen(ok, 'daily'), time: '930', days: ['fri', 'mon'] }, NOW).timing, {
    type: 'daily',
    time: '09:30',
    days: ['fri', 'mon'],
  });
  t('no spec with a problem', d.specOf(fresh, NOW), null);

  const saved = p.asSchedule({ ...raw, timing: { type: 'every', minutes: 120, anchor: 777 }, text: 'Check the build', chat: 'new' });
  const form = d.draftOf(saved, NOW);
  t('an hourly one reads back in hours', [form.when, form.every, form.unit, form.chat, form.chatPicked], ['every', '2', 'hours', 'new', true]);
  t('a 90-minute one reads back in minutes', [d.draftOf({ ...saved, timing: { type: 'every', minutes: 90, anchor: 0 } }, NOW).every, d.draftOf({ ...saved, timing: { type: 'every', minutes: 90, anchor: 0 } }, NOW).unit], ['90', 'min']);
  t('a one-off reads back its day and time', (() => {
    const f = d.draftOf({ ...saved, timing: { type: 'once', at: at(20, 7, 15) } }, NOW);
    return [f.when, f.day, f.time];
  })(), ['once', at(20, 0, 0), '07:15']);
  t('a daily one reads back its days', d.draftOf(p.asSchedule(raw), NOW).days, ['mon', 'fri']);
  t('nothing changed: empty patch (the interval keeps its anchor)', d.patchOf(saved, form, NOW), {});
  t('the interval changed: a new one from now', d.patchOf(saved, { ...form, every: '3' }, NOW), {
    timing: { type: 'every', minutes: 180, anchor: NOW },
  });
  t('text and chat changed', d.patchOf(saved, d.withChat({ ...form, text: 'Run the tests' }, 'same'), NOW), { text: 'Run the tests', chat: 'same' });
  t('no patch with a problem', d.patchOf(saved, { ...form, text: ' ' }, NOW), null);
  t(
    'same timing: days in any order',
    d.sameTiming({ type: 'daily', time: '09:00', days: ['mon', 'fri'] }, { type: 'daily', time: '09:00', days: ['fri', 'mon'] }),
    true,
  );
  t('same timing: different kinds differ', d.sameTiming({ type: 'once', at: 1 }, { type: 'every', minutes: 1, anchor: 1 }), false);

  // --- timeline --------------------------------------------------------------------
  const g = await import(src('ui/schedule/logic/timeline.ts'));
  const s = (id, agentId, extra) => ({ ...p.asSchedule({ ...raw, id, agentId }), ...extra });
  const list = [
    s('s1', 'b', { nextAt: at(13, 15, 0) }),
    s('s2', 'a', { nextAt: at(14, 9, 0) }),
    s('s3', 'b', { nextAt: at(13, 11, 0), on: false, lastRun: { at: at(12, 9, 0), outcome: 'started', detail: null } }),
    s('s4', 'gone', { nextAt: at(13, 11, 0) }),
    s('s5', 'b', { nextAt: null, lastRun: { at: at(13, 9, 0), outcome: 'woke', detail: null } }),
    s('s6', 'b', { nextAt: at(13, 10, 0) }),
  ];
  const agents = [
    { id: 'a', name: 'Alpha', kind: 'opencode' },
    { id: 'b', name: 'Beta', kind: 'claude' },
    { id: 'c', name: 'Gamma', kind: 'opencode' },
  ];
  const line = g.timeline(list, agents, null, NOW);
  t('days in order across agents, today then tomorrow', line.days.map((d) => d.label), ['Today', 'Tomorrow']);
  t('today soonest first, a waiting one (past due) first, a gone agent kept', line.days[0].entries.map((e) => e.schedule.id), ['s6', 's4', 's1']);
  t('a gone agent has no agent', line.days[0].entries[1].agent, null);
  t('an entry names its agent', line.days[0].entries[0].agent.name, 'Beta');
  t('off or done: last touched first', line.rest.map((e) => e.schedule.id), ['s5', 's3']);
  t('one agent only', g.timeline(list, agents, 'a', NOW).days.flatMap((d) => d.entries.map((e) => e.schedule.id)), ['s2']);
  t('one agent with none: empty', [g.timeline(list, agents, 'c', NOW).days, g.timeline(list, agents, 'c', NOW).rest], [[], []]);
  const runs = [{ seq: 3, agentId: 'a' }, { seq: 2, agentId: 'b' }, { seq: 1, agentId: 'a' }];
  t('runs: all, at most max', g.runsFor(runs, null, 2).map((x) => x.seq), [3, 2]);
  t('runs: one agent', g.runsFor(runs, 'a', 10).map((x) => x.seq), [3, 1]);

  // --- time column ------------------------------------------------------------------
  t('column: soon', w.timeColumn({ on: true, nextAt: NOW + 12 * MIN, timing: { type: 'every', minutes: 30, anchor: 0 } }, NOW), { time: '10:32', under: 'in 12 min' });
  t('column: later today', w.timeColumn({ on: true, nextAt: at(13, 15, 0), timing: { type: 'once', at: 0 } }, NOW), { time: '15:00', under: 'in 4 h' });
  t('column: tomorrow has no under', w.timeColumn({ on: true, nextAt: at(14, 9, 0), timing: { type: 'once', at: 0 } }, NOW), { time: '09:00', under: '' });
  t('column: waiting', w.timeColumn({ on: true, nextAt: NOW - MIN, timing: { type: 'once', at: 0 } }, NOW), { time: '10:19', under: 'due' });
  t('column: off', w.timeColumn({ on: false, nextAt: at(14, 9, 0), timing: { type: 'once', at: 0 } }, NOW), { time: 'off', under: '' });
  t('column: done', w.timeColumn({ on: true, nextAt: null, timing: { type: 'once', at: 0 } }, NOW), { time: 'done', under: '' });

  // --- presets ------------------------------------------------------------------------
  const pr = await import(src('ui/schedule/logic/presets.ts'));
  t('once presets at 10:20', pr.oncePresets(NOW).map((x) => [x.label, x.at]), [
    ['In 15 min', NOW + 15 * MIN],
    ['In 1 hour', NOW + HOUR],
    ['Tonight 21:00', at(13, 21, 0)],
    ['Tomorrow 09:00', at(14, 9, 0)],
  ]);
  t('tonight turns into tomorrow after 21:00', pr.oncePresets(at(13, 22, 0))[2], { label: 'Tomorrow 21:00', at: at(14, 21, 0) });
  const base = d.newDraft('a', NOW);
  const later = pr.withOnceAt(base, NOW + 15 * MIN);
  t('a preset sets the day and the time', [later.day, later.time], [Date.UTC(2026, 10, 13), '10:35']);
  t('and reads as picked', pr.isOnceAt(later, NOW + 15 * MIN), true);
  t('an interval preset is picked when the form says it', pr.isEvery({ ...base, every: '30', unit: 'min' }, pr.EVERY_PRESETS[1]), true);
  t('weekdays in any order', pr.isDays({ ...base, days: ['fri', 'mon', 'tue', 'wed', 'thu'] }, pr.DAYS_PRESETS[1]), true);
  t('every day is no days', pr.isDays(base, pr.DAYS_PRESETS[0]), true);

  // --- how tasks reach a kind (Choose agent, agent page) ---------------------------------
  const k2 = await import(src('ui/schedule/logic/scheduleCopy.ts'));
  t('tag: wakes', k2.scheduleTag({ schedules: true, canWake: true }), 'Schedules · wakes or starts it');
  t('tag: starts only', k2.scheduleTag({ schedules: true, canWake: false }), 'Schedules · starts it');
  t('tag: none', k2.scheduleTag({ schedules: false, canWake: false }), 'No schedules');
  t('a kind that can only start says a running agent is restarted', k2.howTasksReachText(false).includes('restarts it'), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

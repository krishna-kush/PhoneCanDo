// The first shift (src/state/logic/starter/): which missions a build gets
// and which ask first, the shift's marks (done beats skipped, the reward
// only for every mission done, kept through Start over), reading a stored
// state back; the dares and their die (src/ui/starter/logic/dares.ts); every
// mission's words (src/ui/starter/copy.ts) and the reward
// (src/ui/starter/reward.ts). Imports the real pure modules (Node 22.18+
// strips their types), so these cannot drift.
// Run: node test_starter.js (or pnpm check:vectors)
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
  const m = await import(src('state/logic/starter/missions.ts'));
  const s = await import(src('state/logic/starter/shift.ts'));
  const d = await import(src('ui/starter/logic/dares.ts'));
  const c = await import(src('ui/starter/copy.ts'));
  const r = await import(src('ui/starter/reward.ts'));

  // --- which missions -----------------------------------------------------------
  t('full: hands, a schedule', m.missionsFor({ channel: 'full', schedules: true }), ['hello', 'terminal', 'hands', 'teammate', 'schedule']);
  t('lite: the full build instead of hands', m.missionsFor({ channel: 'lite', schedules: true }), ['hello', 'terminal', 'upgrade', 'teammate', 'schedule']);
  t('play: no hands at all', m.missionsFor({ channel: 'play', schedules: true }), ['hello', 'terminal', 'teammate', 'schedule']);
  t('no agent can run a schedule: no night shift', m.missionsFor({ channel: 'full', schedules: false }), ['hello', 'terminal', 'hands', 'teammate']);
  t('long ones ask first', ['hello', 'terminal', 'hands', 'upgrade', 'teammate', 'schedule'].filter(m.isLong), ['hands', 'teammate', 'schedule']);
  t('mission ids', [m.isMissionId('hello'), m.isMissionId('nope'), m.isMissionId(3)], [true, false, false]);

  // --- the shift ----------------------------------------------------------------
  const list = m.missionsFor({ channel: 'full', schedules: true });
  const fresh = s.FRESH;
  t('fresh: offered, nothing marked', [fresh.status, s.progress(fresh, list)], ['new', { done: 0, skipped: 0, total: 5, next: 'hello' }]);
  t('fresh: no card yet (the hello first)', s.shows(fresh), false);
  const on = s.start(fresh);
  t('Start shift: on, card shows', [on.status, s.shows(on)], ['on', true]);
  t('start twice: same state', s.start(on) === on, true);
  t('wing it: off, no card', [s.windOff(on).status, s.shows(s.windOff(on))], ['off', false]);

  let x = s.markDone(on, 'hello', list);
  t('done: next is the terminal', s.progress(x, list), { done: 1, skipped: 0, total: 5, next: 'terminal' });
  t('done twice: same state', s.markDone(x, 'hello', list) === x, true);
  x = s.skip(x, 'terminal');
  t('skipped: counted, next goes on', s.progress(x, list), { done: 1, skipped: 1, total: 5, next: 'hands' });
  t('a done one is not skipped', s.skip(x, 'hello').marks.hello, 'done');
  t('done beats skipped', s.markDone(x, 'terminal', list).marks.terminal, 'done');
  const back = s.unskip(x, 'terminal');
  t('Try it: unmarked again', [back.marks.terminal, s.progress(back, list).next], [undefined, 'terminal']);
  t('Try it on a done one: nothing', s.unskip(x, 'hello') === x, true);

  // Marks count whatever the shift is doing: one done while off is ticked.
  t('done while off', s.markDone(s.windOff(on), 'teammate', list).marks.teammate, 'done');

  // The finale and the reward.
  let all = on;
  for (const id of list) all = s.markDone(all, id, list);
  t('every one done: resolved and earned', [s.resolved(all, list), all.earned], [true, true]);
  let some = s.skip(on, 'schedule');
  for (const id of list.filter((id) => id !== 'schedule')) some = s.markDone(some, id, list);
  t('one skipped: resolved, not earned', [s.resolved(some, list), some.earned], [true, false]);
  const tried = s.markDone(s.unskip(some, 'schedule'), 'schedule', list);
  t('the skipped one done after all: earned', tried.earned, true);
  const seen = s.finish(all);
  t('Back to work: the card goes', [seen.finaleSeen, s.shows(seen)], [true, false]);
  t('Try it after the finale: it comes back', s.unskip(s.finish(some), 'schedule').finaleSeen, false);
  const again = s.restart(seen);
  t('Start over: fresh marks, on, reward kept', [again.status, again.marks, again.finaleSeen, again.earned], ['on', {}, false, true]);
  t('an empty list earns nothing', s.markDone(on, 'hello', []).earned, false);

  // Reading it back.
  t('parse: nothing stored', s.parseShift(null), s.FRESH);
  t('parse: junk', s.parseShift('{oops'), s.FRESH);
  t('parse: round trip', s.parseShift(JSON.stringify(some)), some);
  t(
    'parse: unknown missions and marks dropped, bad status is new',
    s.parseShift(JSON.stringify({ status: 'maybe', marks: { hello: 'done', nope: 'done', terminal: 'meh' }, earned: 1 })),
    { status: 'new', marks: { hello: 'done' }, finaleSeen: false, earned: false },
  );

  // --- dares --------------------------------------------------------------------
  for (const set of ['chat', 'shell', 'hands']) {
    for (const linux of [true, false]) {
      const dares = d.daresFor(set, linux);
      t(`${set}${linux ? '' : ' (android)'}: some dares, none twice`, dares.length > 0 && new Set(dares).size === dares.length, true);
    }
  }
  t('no apt or python without Linux', d.daresFor('shell', false).some((x) => /apt|python/.test(x)), false);
  t('no python in chat without Linux', d.daresFor('chat', false).some((x) => /Python/.test(x)), false);
  // A roll never lands on the dare it left, for any rand, and stays in range.
  let ok = true;
  for (let count = 2; count <= 6; count++) {
    for (let cur = 0; cur < count; cur++) {
      for (const rand of [0, 0.2, 0.5, 0.8, 0.9999]) {
        const n = d.rollDare(count, cur, () => rand);
        if (n === cur || n < 0 || n >= count) ok = false;
      }
    }
  }
  t('a roll is always another dare', ok, true);
  t('one dare: it stays', d.rollDare(1, 0, () => 0.5), 0);
  const faces = [0, 1, 2, 3, 4, 5].map(d.dieFace);
  t('the die shows all six faces in six rolls', new Set(faces).size, 6);
  t('the die changes every roll', faces.every((f, i) => i === 0 || f !== faces[i - 1]), true);

  // --- words --------------------------------------------------------------------
  for (const id of ['hello', 'terminal', 'hands', 'upgrade', 'teammate', 'schedule']) {
    for (const linux of [true, false]) {
      const w = c.missionCopy(id, { linux, models: true });
      const filled = [w.title, w.what, w.where, w.go, ...w.steps].every((x) => typeof x === 'string' && x.length > 0);
      t(`${id}${linux ? '' : ' (android)'}: every line there`, filled && w.steps.length > 0, true);
    }
  }
  t('Say hi names Models only where it is', [
    c.missionCopy('hello', { linux: true, models: true }).steps[0].includes('Models'),
    c.missionCopy('hello', { linux: true, models: false }).steps[0].includes('Models'),
  ], [true, false]);
  t('a teammate without Linux: no Claude Code', c.missionCopy('teammate', { linux: false, models: false }).what.includes('Claude Code'), false);
  t('kicker', c.shiftKicker(2, 5), 'first shift · 2/5');
  t('card line', [c.cardLine('Say hi'), c.cardLine(null)], ['Next: Say hi', 'All stamped! See how you did']);
  t('reward owed', [c.rewardOwed(1), c.rewardOwed(2)], [
    'Finish the skipped job to earn the Shift lead look: a hard hat and a medal.',
    'Finish the 2 skipped jobs to earn the Shift lead look: a hard hat and a medal.',
  ]);
  t('the page line wraps', c.pageLine(0) === c.pageLine(5), true);

  // --- the reward ----------------------------------------------------------------
  t('the reward is earned by the shift only', [r.isEarned(r.REWARD_DESIGN, true), r.isEarned(r.REWARD_DESIGN, false), r.isEarned('plain', true)], [true, false, false]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

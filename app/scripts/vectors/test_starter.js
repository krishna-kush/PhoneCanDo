// The first shift (src/state/logic/starter/): which missions a build gets
// and which ask first, the shift's marks (done beats skipped, the reward
// only for every mission done, kept through Start over), reading a stored
// state back; the dares and their die (src/ui/starter/logic/dares.ts); every
// mission's words (src/ui/starter/copy.ts) and the reward
// (src/ui/starter/reward.ts); the walks to each mission's place, where the
// guide draws and what it says (src/ui/starter/walk/). Imports the real
// pure modules (Node 22.18+ strips their types), so these cannot drift.
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
  const wk = await import(src('ui/starter/walk/logic/walks.ts'));
  const fr = await import(src('ui/starter/walk/logic/frame.ts'));
  const wc = await import(src('ui/starter/walk/copy.ts'));
  const wa = await import(src('ui/starter/walk/logic/walkAgent.ts'));

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
      const filled = [w.title, w.what, w.go, ...w.where, ...w.steps].every((x) => typeof x === 'string' && x.length > 0);
      t(`${id}${linux ? '' : ' (android)'}: every line there`, filled && w.where.length > 0 && w.steps.length > 0, true);
    }
  }
  t('Say hi names Models only where it is', [
    c.missionCopy('hello', { linux: true, models: true }).steps[0].includes('Models'),
    c.missionCopy('hello', { linux: true, models: false }).steps[0].includes('Models'),
  ], [true, false]);
  t('a teammate without Linux: no Claude Code', c.missionCopy('teammate', { linux: false, models: false }).what.includes('Claude Code'), false);
  t('hands: the bank apps question, while it is still to come', [true, false].map((q) =>
    c.missionCopy('hands', { linux: true, models: true, bankQuestion: q }).steps.some((x) => x.includes('bank apps'))), [true, false]);
  t('hands: the dare stays the last step', c.missionCopy('hands', { linux: true, models: true, bankQuestion: true }).steps.at(-1), 'Then copy a dare and paste it in the chat.');
  t('kicker', c.shiftKicker(2, 5), 'first shift · 2/5');
  t('card line', [c.cardLine('Say hi'), c.cardLine(null)], ['Next: Say hi', 'All stamped! See how you did']);
  t('reward owed', [c.rewardOwed(1), c.rewardOwed(2)], [
    'Finish the skipped job to earn the Shift lead look: a hard hat and a medal.',
    'Finish the 2 skipped jobs to earn the Shift lead look: a hard hat and a medal.',
  ]);
  t('the page line wraps', c.pageLine(0) === c.pageLine(5), true);

  // --- the walks -----------------------------------------------------------------
  const ALL_MISSIONS = ['hello', 'terminal', 'hands', 'upgrade', 'teammate', 'schedule'];
  const page = (route) => ({ route });
  t('place: Home', wk.placeOf([], false), 'home');
  t('place: the drawer, over anything', wk.placeOf([page({ name: 'settings' })], true), 'drawer');
  t('place: the top page', wk.placeOf([page({ name: 'settings' }), page({ name: 'schedules' })], false), 'schedules');
  t("place: one of Settings' pages", wk.placeOf([page({ name: 'settings-page', page: 'updates' })], false), 'settings-page:updates');

  const noSpot = () => false;
  const anySpot = () => true;
  const only = (...ids) => (id) => ids.includes(id);
  const HOMES = ['tui', 'web'];
  const walks = (id) => HOMES.map((home) => wk.walkFor(id, home));
  const at = (mission, place, shown, home = 'tui') => {
    const a = wk.walkAt(wk.walkFor(mission, home), place, shown);
    return a.kind === 'step' ? `${a.step.spot ?? a.step.id}${a.ready ? '' : ' (waits)'} ${a.step.hop}/${a.hops}` : a.kind;
  };
  t('Night shift: my name, Schedules, Add', [at('schedule', 'home', anySpot), at('schedule', 'drawer', anySpot), at('schedule', 'schedules', only('schedules.add'))], [
    'home.name 1/4',
    'drawer.schedules 2/4',
    'schedules.add 3/4',
  ]);
  t('Night shift: an empty list points at its big Add', at('schedule', 'schedules', only('schedules.add', 'schedules.addFirst')), 'schedules.addFirst 3/4');
  t("Night shift: the editor open, its save", at('schedule', 'schedules', only('schedules.save')), 'schedules.save 4/4');
  t('a spot not on screen yet: the first step here waits for it', at('schedule', 'schedules', noSpot), 'schedules.add (waits) 3/4');
  t('the terminal: ⋮, then Agent settings once the menu is open', [at('terminal', 'home', only('home.menu')), at('terminal', 'home', only('home.menu', 'menu.agent'))], [
    'home.menu 1/3',
    'menu.agent 2/3',
  ]);
  t('the terminal: Open terminal on the agent page', at('terminal', 'agent', anySpot), 'agent.terminal 3/3');
  t('arrived: a terminal open, Updates open', [at('terminal', 'terminal', anySpot), at('upgrade', 'settings-page:updates', anySpot)], ['goal', 'goal']);
  t('Give me hands: my name, Settings, Phone control', [at('hands', 'home', anySpot), at('hands', 'drawer', anySpot), at('hands', 'settings', anySpot)], [
    'home.name 1/3',
    'drawer.settings 2/3',
    'settings.phone 3/3',
  ]);
  t('a teammate: New agent, Next, the recommended place', [at('teammate', 'drawer', anySpot), at('teammate', 'new-agent', anySpot), at('teammate', 'new-agent-place', anySpot)], [
    'drawer.newAgent 2/4',
    'newAgent.next 3/4',
    'newAgent.place 4/4',
  ]);
  t('a teammate: a Linux of its own to download, words alone', [at('teammate', 'new-env-os', noSpot), at('teammate', 'new-env-pull', noSpot)], ['machine 4/4', 'machine 4/4']);
  t('a teammate: making your own agent, Next waits on the way back', at('teammate', 'custom-agent', noSpot), 'newAgent.next (waits) 3/4');
  t('Say hi in a terminal: the chat box, at its foot', [at('hello', 'home', anySpot), wk.walkFor('hello', 'tui').steps[0].foot], ['home.chat 1/1', true]);
  const web = (...ids) => at('hello', 'home', only(...ids), 'web');
  t('Say hi in a web UI with no chat: projects, Add project, the folder, a new chat, the box', [
    web('web.projects'),
    web('web.projects', 'web.addProject'),
    web('web.pickFolder'),
    web('web.projects', 'web.newChat'),
    web('web.composer'),
  ], ['web.projects 1/5', 'web.addProject 2/5', 'web.pickFolder 3/5', 'web.newChat 4/5', 'web.composer 5/5']);
  t('Say hi in a web UI: nothing in front yet waits on its projects', web(), 'web.projects (waits) 1/5');
  t("Say hi in a web UI never points at a terminal's box", web('home.chat'), 'web.projects (waits) 1/5');
  t('Say hi in a web UI: off Home is a wrong turn', at('hello', 'drawer', anySpot, 'web'), 'lost');
  // Which agent a walk goes with: the default kind's (opencode) for the ones through an agent's own screens.
  const crew = [{ id: 'c1', kind: 'claude-code' }, { id: 'o1', kind: 'opencode' }, { id: 'o2', kind: 'opencode' }];
  const isDefault = (kind) => kind === 'opencode';
  t('Say hi and the terminal go with opencode: the active one, else the first', [
    wa.walkAgent('hello', crew, 'o2', isDefault),
    wa.walkAgent('hello', crew, 'c1', isDefault),
    wa.walkAgent('terminal', crew, 'c1', isDefault),
  ], ['o2', 'o1', 'o1']);
  t('with no opencode agent, the active one as it is', wa.walkAgent('hello', [crew[0]], 'c1', isDefault), 'c1');
  t('walks through the app go with nobody', ['hands', 'upgrade', 'teammate', 'schedule'].map((id) => wa.walkAgent(id, crew, 'c1', isDefault)), [null, null, null, null]);
  t('the switch and the wrong agent name it', [wc.switchedHint('opencode 1a').includes('opencode 1a'), wc.awayLine('opencode 1a').includes('opencode 1a')], [true, true]);

  const raw = (mission, place, shown, home = 'tui') => wk.walkAt(wk.walkFor(mission, home), place, shown);
  const addOpen = raw('hello', 'home', only('web.projects', 'web.addProject'), 'web');
  t('a step back: a lower hop, a wrong turn, its spot gone', [
    wk.stepsBack(addOpen, raw('hello', 'home', only('web.projects'), 'web')),
    wk.stepsBack(raw('schedule', 'drawer', anySpot), raw('schedule', 'models', anySpot)),
    wk.stepsBack(raw('schedule', 'schedules', only('schedules.add')), raw('schedule', 'schedules', noSpot)),
  ], [true, true, true]);
  t('not a step back: on, the same, nothing shown yet, the walk over', [
    wk.stepsBack(addOpen, raw('hello', 'home', only('web.pickFolder'), 'web')),
    wk.stepsBack(addOpen, addOpen),
    wk.stepsBack(null, addOpen),
    wk.stepsBack(addOpen, null),
    wk.stepsBack(raw('schedule', 'schedules', only('schedules.add')), raw('schedule', 'schedules', only('schedules.addFirst'))),
  ], [false, false, false, false, false]);
  t('a wrong turn', [at('schedule', 'models', anySpot), at('terminal', 'drawer', anySpot), at('hands', 'agent', anySpot)], ['lost', 'lost', 'lost']);
  t('the first shift page: the guide steps aside', at('teammate', 'starter', anySpot), 'aside');
  t('only the open menu floats over the app', ALL_MISSIONS.flatMap((id) => wk.walkFor(id, 'tui').steps.filter((s) => s.floats).map((s) => s.spot)), ['menu.agent']);
  t('nothing in a web UI floats', wk.walkFor('hello', 'web').steps.some((s) => s.floats), false);
  t('each walk counts its hops from 1, none missed', ALL_MISSIONS.flatMap(walks).every((walk) => {
    const hops = new Set(walk.steps.map((s) => s.hop));
    return [...Array(wk.hopsOf(walk)).keys()].every((i) => hops.has(i + 1));
  }), true);

  // --- what the guide says ---------------------------------------------------------
  t('every step has its words', ALL_MISSIONS.flatMap(walks).every((walk) => walk.steps.every((s) =>
    [true, false].every((linux) => wc.stepLine(s.id, { linux, models: true }).length > 0))), true);
  const asAgent = /\b(my|me|i|i'm|i've|i'll)\b/i;
  t('the guide (A-09) never speaks as your agent', [
    ...ALL_MISSIONS.flatMap(walks).flatMap((w) => w.steps.map((s) => wc.stepLine(s.id, { linux: true, models: true }))),
    ...ALL_MISSIONS.map((id) => wc.doneLine(id)),
  ].filter((line) => asAgent.test(line)), []);
  t('Say hi names a model only where models are', [
    wc.stepLine('chat', { linux: true, models: true }).includes('model'),
    wc.stepLine('chat', { linux: true, models: false }).includes('model'),
  ], [true, false]);
  t('warm, warmer, hot', [1, 2, 3, 4].map((hop) => wc.heatCaption(hop, 4)), ['warm', 'warm', 'warmer', 'hot!']);
  t('a one-hop walk is hot at once', wc.heatCaption(1, 1), 'hot!');
  t('kicker', wc.walkKicker('Night shift', 2, 4), 'Night shift · 2/4');
  t('every mission has its stamp line', ALL_MISSIONS.every((id) => wc.doneLine(id).length > 0), true);
  t('scrolled away, either way', [wc.outOfSight('below').startsWith('↓'), wc.outOfSight('above').startsWith('↑')], [true, true]);

  // --- where the guide draws ---------------------------------------------------------
  t('the frame is what shows, less the press reach', fr.frameOf({ x: 0, y: 0, width: 100, height: 40 }, { x: 16, y: 4 }, false), { x: 16, y: 4, width: 68, height: 32 });
  t('the chat: its foot only', fr.frameOf({ x: 0, y: 100, width: 300, height: 500 }, undefined, true), { x: 0, y: 524, width: 300, height: 76 });
  t('a short spot is its own foot', fr.frameOf({ x: 0, y: 0, width: 10, height: 40 }, undefined, true), { x: 0, y: 0, width: 10, height: 40 });
  const room = { width: 400, top: 30, bottom: 800 };
  const box = (y, height) => ({ x: 0, y, width: 100, height });
  t('in sight or scrolled away', [fr.sightOf(box(-50, 40), room), fr.sightOf(box(100, 40), room), fr.sightOf(box(900, 40), room)], ['above', 'on', 'below']);
  t('off to a side (a drawer row not slid in yet)', [
    fr.sightOf({ x: -300, y: 100, width: 280, height: 40 }, room),
    fr.sightOf({ x: 410, y: 100, width: 100, height: 40 }, room),
    fr.sightOf({ x: -20, y: 100, width: 280, height: 40 }, room),
  ], ['aside', 'aside', 'on']);
  t('bubble: under a spot near the top', fr.bubbleSpot(box(40, 40), room, 120, 16), { top: 96, side: 'below' });
  t('bubble: over a spot near the foot', fr.bubbleSpot(box(700, 76), room, 120, 16), { top: 564, side: 'above' });
  t('bubble: kept in the room', fr.bubbleSpot(box(30, 700), room, 120, 16), { top: 680, side: 'below' });
  t('bubble: no frame, at the foot', fr.bubbleSpot(null, room, 120, 16), { top: 680, side: null });
  t('the arrow under the frame, kept from the ends', [
    fr.arrowX({ x: 100, y: 0, width: 50, height: 10 }, 12, 376, 20),
    fr.arrowX({ x: 0, y: 0, width: 10, height: 10 }, 12, 376, 20),
  ], [113, 20]);
  t('tucked away from the spot', [
    fr.tuckedAt({ x: 300, y: 0, width: 80, height: 10 }, room, 48, 12),
    fr.tuckedAt({ x: 0, y: 0, width: 80, height: 10 }, room, 48, 12),
    fr.tuckedAt(null, room, 48, 12),
  ], [{ left: 12, top: 752 }, { left: 340, top: 752 }, { left: 340, top: 752 }]);
  t('inside a web view: its page pixels scaled to the view', [
    fr.insideOf({ x: 0, y: 80, width: 432, height: 700 }, { x: 14, y: 21, width: 404, height: 40 }, 432),
    fr.insideOf({ x: 10, y: 0, width: 400, height: 700 }, { x: 100, y: 50, width: 80, height: 20 }, 800),
  ], [{ x: 14, y: 101, width: 404, height: 40 }, { x: 60, y: 25, width: 40, height: 10 }]);
  t('still within a pixel', [
    fr.sameRect(box(10, 40), { ...box(10.6, 40), x: 0.4 }),
    fr.sameRect(box(10, 40), box(12, 40)),
  ], [true, false]);

  // --- the reward ----------------------------------------------------------------
  t('the reward is earned by the shift only', [r.isEarned(r.REWARD_DESIGN, true), r.isEarned(r.REWARD_DESIGN, false), r.isEarned('plain', true)], [true, false, false]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

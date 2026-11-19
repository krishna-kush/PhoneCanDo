// Presence: what native sends, as the app reads it
// (src/engine/presence/parse.ts), the mascot's figures the overlay draws
// (src/engine/presence/figures.ts, contract: the figures JSON), and the
// copy of the status line and Home's hand-over card
// (src/ui/presence/copy.ts). Imports the real pure modules (Node 22.18+
// strips their types), so these cannot drift.
// Run: node test_presence.js (or pnpm check:vectors)
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
const root = (...parts) => pathToFileURL(path.join(__dirname, '../../..', ...parts)).href;

(async () => {
  // --- what native sends ----------------------------------------------------------
  const p = await import(src('engine/presence/parse.ts'));
  const frame = {
    driver: { agentId: 'a1', name: 'Ada' },
    handOver: { agentId: 'a1', agentName: 'Ada', mode: 'watch', by: 'agent', why: '  type your password  ' },
    statuses: { a1: { text: 'running the tests', mood: 'working' }, a2: { text: 'which test broke', mood: 'thinking' } },
  };
  const read = p.asPresence(frame);
  t('a frame reads whole', read, {
    driver: { agentId: 'a1', name: 'Ada' },
    handOver: { agentId: 'a1', agentName: 'Ada', mode: 'watch', by: 'agent', why: 'type your password' },
    statuses: { a1: { text: 'running the tests', mood: 'working' }, a2: { text: 'which test broke', mood: 'thinking' } },
  });
  t('nothing, or not a map: nobody, no lines', [p.asPresence(null), p.asPresence([1]), p.asPresence('x')], [p.NO_PRESENCE, p.NO_PRESENCE, p.NO_PRESENCE]);
  t('enum names in capitals read the same', p.asHandOver({ agentId: 'a', mode: 'PAUSED', by: 'AGENT' }), { agentId: 'a', agentName: 'a', mode: 'paused', by: 'agent', why: null });
  t('a mode we do not know: no hand-over', p.asHandOver({ agentId: 'a', mode: 'dance' }), null);
  t('no agent: no hand-over', p.asHandOver({ mode: 'watch' }), null);
  t('who started it defaults to you, an empty reason is none', p.asHandOver({ agentId: 'a', agentName: 'Bo', mode: 'watch', by: 7, why: '   ' }), { agentId: 'a', agentName: 'Bo', mode: 'watch', by: 'user', why: null });
  t('no driver id: nobody drives', p.asPresence({ driver: { name: 'x' } }).driver, null);
  t('a driver with no name goes by its id', p.asPresence({ driver: { agentId: 'z' } }).driver, { agentId: 'z', name: 'z' });
  t('an empty line is no line; a strange mood is working', p.asPresence({ statuses: { a: { text: ' ' }, b: { text: 'x', mood: 'zen' }, c: 'nope' } }).statuses, { b: { text: 'x', mood: 'working' } });
  t('statuses not a map: none', p.asPresence({ statuses: [1, 2] }).statuses, {});

  // --- the copy ---------------------------------------------------------------------
  const c = await import(src('ui/presence/copy.ts'));
  t('a line by its mood', ['working', 'thinking', 'waiting'].map((mood) => c.statusText({ text: 'x', mood })), ['> x', '… x', '‖ x']);
  t('a line for a screen reader', c.statusLabel({ text: 'which test broke', mood: 'thinking' }), 'thinking: which test broke');
  const watch = c.handOverCopy(read.handOver);
  t('watch, from the agent: its reason, Your turn', [watch.title, watch.buttons.map((b) => [b.label, b.act]), watch.mood], [
    'Ada handed you the phone: type your password', [['Your turn', 'GIVE_BACK']], 'awake',
  ]);
  const mine = c.handOverCopy({ agentId: 'a1', agentName: 'Ada', mode: 'watch', by: 'user', why: null });
  t('watch, from you: you have the controls', [mine.title, mine.line], ['You have the controls', 'Ada watches while you drive. Done? Hand it back.']);
  const paused = c.handOverCopy({ agentId: 'a1', agentName: 'Ada', mode: 'paused', by: 'user', why: null });
  t('paused: Leave it on the left, Start me again on the right', [paused.title, paused.buttons.map((b) => [b.label, b.act, b.variant]), paused.mood], [
    'Ada is paused', [['Leave it', 'LEAVE', 'ghost'], ['Start me again', 'START_AGAIN', 'primary']], 'asleep',
  ]);
  t('paused for a reason: it leads the line, one stop', [
    c.handOverCopy({ agentId: 'a', agentName: 'Ada', mode: 'paused', by: 'agent', why: 'a payment screen' }).line,
    c.handOverCopy({ agentId: 'a', agentName: 'Ada', mode: 'paused', by: 'agent', why: 'Your bank asks for a code!' }).line,
  ], ['a payment screen. It can\'t use the phone until you start it again.', 'Your bank asks for a code! It can\'t use the phone until you start it again.']);
  t('a screen reader hears it all', c.handOverLabel({ agentId: 'a1', agentName: 'Ada', mode: 'paused', by: 'user', why: null }), 'Ada is paused. It can\'t use the phone until you start it again.');
  const words = [watch, mine, paused].flatMap((x) => [x.title, x.line, ...x.buttons.map((b) => b.label)]).join(' ');
  t('never "the owner"', /owner/i.test(words), false);

  // --- the mascot's figures ---------------------------------------------------------
  const f = await import(src('engine/presence/figures.ts'));
  const { bodyOf } = await import(root('mascot/body.ts'));
  const body = bodyOf(require('../../../theme/logo.json'));
  const look = { design: 'plain', shape: 'wide', swap: false };
  const figs = f.mascotFigures(look, body);
  t('version 1, the shape its stretch', [figs.v, figs.shape], [1, { w: body.short, h: 1 }]);
  t('the poses the overlay draws', [Object.keys(figs.poses.front), Object.keys(figs.poses.side), Array.isArray(figs.poses.back.eyes)], [
    ['dot', 'wide', 'sleepy', 'shut', 'happy'], ['dot', 'shut'], true,
  ]);
  t('two eyes face on, one side on, none from behind', [figs.poses.front.dot.eyes.length, figs.poses.side.dot.eyes.length, figs.poses.back.eyes.length], [2, 1, 0]);
  t('laid out at size 100', Math.round(figs.poses.front.dot.front.h), 100);
  t('side on it faces right: its eye on the right half', figs.poses.side.dot.eyes[0].open.x > figs.poses.side.dot.front.x + figs.poses.side.dot.front.w / 2, true);
  t('shut eyes show no pupil, open ones do', [figs.poses.front.shut.eyes[0].pupil, figs.poses.front.dot.eyes[0].pupil != null], [null, true]);
  t('no gaze: the pupils sit the same in both eyes', (() => {
    const [a, b] = figs.poses.front.dot.eyes;
    return Math.round((a.pupil.x - a.open.x) * 100) === Math.round((b.pupil.x - b.open.x) * 100);
  })(), true);
  t('a swapped look turns its inks', [f.mascotFigures({ ...look, swap: true }, body).poses.front.dot.front.ink, figs.poses.front.dot.front.ink], ['amber', 'red']);
  const json = JSON.parse(f.mascotFiguresJson(look, body));
  t('the JSON: places to a hundredth', JSON.stringify(json).match(/\d+\.\d{3,}/), null);
  t('the JSON keeps every pose', [json.v, Object.keys(json.poses)], [1, ['front', 'side', 'back']]);
  t('one look, one JSON', f.mascotFiguresJson(look, body), f.mascotFiguresJson({ ...look }, body));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

// Navigation: the page stack over Home (src/state/app/stack.ts: open, back,
// a New agent run handing over, a deleted agent, terminals, a notification
// bringing Home), how pages move (src/ui/nav/motion.ts) and A-01's face
// for an agent (src/ui/common/face/mood.ts, lines.ts). Imports the real pure
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_nav_stack.js (or pnpm check:vectors)
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
// import() wants a URL: a bare Windows path (C:\...) is not one.
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;
const names = (pages) => pages.map((p) => p.route.name);

(async () => {
  // --- the stack -----------------------------------------------------------
  const s = await import(src('state/app/stack.ts'));
  const p = (key, route) => ({ key, route });
  const agent = p(1, { name: 'agent', agentId: 'a1' });
  t('push opens on top', names(s.pushPage([agent], p(2, { name: 'agent-model', agentId: 'a1' }))), ['agent', 'agent-model']);
  t('pop goes one down', names(s.popPage([agent, p(2, { name: 'settings' })])), ['agent']);
  t('pop on Home stays Home', s.popPage([]), []);
  t('replace swaps the top', names(s.replaceTop([agent, p(2, { name: 'folder-picker' })], p(3, { name: 'settings' }))), ['agent', 'settings']);

  // A New agent run from the systems list: its steps go, the agent opens.
  const pick = { kindId: 'oc', modelId: null };
  const run = [
    p(1, { name: 'systems' }),
    p(2, { name: 'new-agent' }),
    p(3, { name: 'new-agent-place', pick }),
    p(4, { name: 'new-env-os', pick }),
    p(5, { name: 'new-env-tags', repo: 'alpine', pick }),
    p(6, { name: 'new-env-confirm', repo: 'alpine', tag: { name: '3.22' }, typed: false, pick }),
  ];
  t('the download replaces the run', names(s.afterCreation(run, p(7, { name: 'new-env-pull', repo: 'alpine', tag: '3.22', envId: 'e' }))), ['systems', 'new-env-pull']);
  t('the agent replaces the download', names(s.afterCreation([p(1, { name: 'new-env-pull' })], p(2, { name: 'agent', agentId: 'a' }))), ['agent']);
  t('from the drawer: back lands on Home', names(s.afterCreation(run.slice(1), p(7, { name: 'agent', agentId: 'a' }))), ['agent']);
  t('a custom form from the list is not a run step', s.isCreationRoute({ name: 'custom-agent', kindId: null }), false);
  // Add system from the systems list: its steps go too, Back returns to the list.
  const addRun = [p(1, { name: 'systems' }), p(2, { name: 'add-system' }), p(3, { name: 'new-env-os' }), p(4, { name: 'new-agent', target: { kind: 'own' } })];
  t('Add system hands over to its download', names(s.afterCreation(addRun, p(5, { name: 'new-env-pull' }))), ['systems', 'new-env-pull']);
  t('a system page is not a run step', s.isCreationRoute({ name: 'system', envId: 'e' }), false);

  // A deleted agent: its pages and whatever opened above them go.
  const agentPages = [p(1, { name: 'systems' }), agent, p(2, { name: 'agent-model', agentId: 'a1' }), p(3, { name: 'models' })];
  t('deleted agent leaves its pages', names(s.withoutAgent(agentPages, 'a1')), ['systems']);
  t('another agent stays', names(s.withoutAgent(agentPages, 'a2')), ['systems', 'agent', 'agent-model', 'models']);

  // Terminals: one at a time, on top; the folder picker hands over to one.
  const tui = { id: 1, kind: 'tui', agentId: 'a1', dir: '/x' };
  const sh = { id: 2, kind: 'linux', agentId: 'a1' };
  const picking = [agent, p(2, { name: 'folder-picker' })];
  const opened = s.withTerminal(picking, p(3, { name: 'terminal', session: tui }));
  t('the picker hands over to the terminal', names(opened), ['agent', 'terminal']);
  t('a second terminal replaces the first', s.terminalOf(s.withTerminal(opened, p(4, { name: 'terminal', session: sh }))), sh);
  t('close leaves the page under it', names(s.withoutTerminal(opened)), ['agent']);
  t('no terminal open', s.terminalOf([agent]), null);

  // A notification: Home in front, but a running terminal stays on top.
  t('towards Home: pages go', s.towardHome([agent, p(2, { name: 'settings' })]), []);
  t('towards Home: the terminal stays', names(s.towardHome([agent, p(2, { name: 'terminal', session: sh }), p(3, { name: 'settings' })])), ['terminal']);

  // --- motion --------------------------------------------------------------
  const m = await import(src('ui/nav/motion.ts'));
  const still = { push: 1, pull: 0, commit: 0, edge: 1 };
  t('the top page is where it is', m.layerStyle('top', still, 400), { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] });
  t('a page below is invisible', m.layerStyle('hidden', still, 400).opacity, 0);
  t('entering starts a quarter right, unseen', [m.layerStyle('enter', { ...still, push: 0 }, 400).transform[0].translateX, m.layerStyle('enter', { ...still, push: 0 }, 400).opacity], [100, 0]);
  t('entering ends in place', m.layerStyle('enter', still, 400).transform[0].translateX, 0);
  const pulled = m.layerStyle('leave', { push: 1, pull: 1, commit: 0, edge: 1 }, 400);
  t('under the thumb: 90%, a little right', [pulled.transform[1].scale, pulled.transform[0].translateX], [0.9, 12]);
  t('transform and opacity only (no relayout, no clipping)', Object.keys(pulled).sort(), ['opacity', 'transform']);
  t('a swipe from the right edge pulls it left', m.layerStyle('leave', { push: 1, pull: 1, commit: 0, edge: -1 }, 400).transform[0].translateX, -12);
  const leftEdge = m.layerStyle('leave', { push: 1, pull: 1, commit: 1, edge: 1 }, 400).transform[0].translateX;
  const rightEdge = m.layerStyle('leave', { push: 1, pull: 1, commit: 1, edge: -1 }, 400).transform[0].translateX;
  t('committed, it leaves to the right from either edge', [leftEdge > 0, rightEdge > 0], [true, true]);
  t('a back key leaves to the right', m.layerStyle('leave', { push: 1, pull: 0, commit: 1, edge: 1 }, 400).transform[0].translateX, 200);
  t('a back key still shrinks it', m.layerStyle('leave', { push: 1, pull: 0, commit: 0.5, edge: 1 }, 400).transform[1].scale, 0.9);
  t('committed: gone', m.layerStyle('leave', { push: 1, pull: 0.4, commit: 1, edge: 1 }, 400).opacity, 0);
  t('the page below settles in place', m.layerStyle('reveal', { push: 1, pull: 0.3, commit: 1, edge: 1 }, 400).transform[0].translateX, -0);
  const rest = { kind: 0, moving: '', under: '', top: '7', below: '3', previewing: false };
  t('at rest: the top in front, the rest hidden', ['7', '3', 'home'].map((k) => m.roleOf(k, rest)), ['top', 'hidden', 'hidden']);
  t('a preview: the top leaves, the one below reveals', ['7', '3', 'home'].map((k) => m.roleOf(k, { ...rest, previewing: true })), ['leave', 'reveal', 'hidden']);
  t('a push: it enters over the one that exits', ['8', '7', '3'].map((k) => m.roleOf(k, { ...rest, kind: 1, moving: '8', under: '7' })), ['enter', 'exit', 'hidden']);
  t('a pop: it leaves over the one revealed', ['7', '3', 'home'].map((k) => m.roleOf(k, { ...rest, kind: 2, moving: '7', under: '3' })), ['leave', 'reveal', 'hidden']);
  t('hidden layers share one style object', m.layerStyle('hidden', still, 400) === m.layerStyle('hidden', { ...still, push: 0.3 }, 400), true);
  t('decelerate shows the gesture early', m.decelerate(0.25) > 0.5, true);
  t('decelerate ends at 1', [m.decelerate(0), m.decelerate(1), m.decelerate(2)], [0, 1, 1]);

  // --- what a change of the stack does on screen ----------------------------
  const tr = await import(src('ui/nav/transitions.ts'));
  const settings = p(7, { name: 'settings' });
  const about = p(8, { name: 'about' });
  const atRest = (pages) => ({ pages, anim: null });
  const layers = (shown) => tr.layersOf(shown).map((l) => `${l.key}:${l.role}`);
  t('at rest: Home alone in front', layers(atRest([])), ['home:top']);
  const one = [settings];
  t('nothing changed: no step', tr.stepFor(atRest(one), one, 1).kind, 'none');
  const pushed = tr.stepFor(atRest([]), [settings], 1);
  t('a new page is a push over Home', [pushed.kind, pushed.anim.top, pushed.anim.under], ['push', '7', 'home']);
  t('a push: it enters, Home exits', layers(pushed.shown), ['home:exit', '7:enter']);
  t('a push: only the entering page takes touches', ['home', '7'].map((k) => tr.roleIn(pushed.shown, k)), ['exit', 'enter']);
  const back = tr.stepFor(atRest([settings]), [], 2);
  t('the top page going is a pop to Home', [back.kind, back.anim.leaving.key, back.anim.reveal], ['pop', 7, 'home']);
  t('a pop: the leaving page stays drawn on top', layers(back.shown), ['home:reveal', '7:leave']);
  t('a pop: roleIn agrees with the layers', ['home', '7'].map((k) => tr.roleIn(back.shown, k)), ['reveal', 'leave']);
  const swapped = tr.stepFor(atRest([settings]), [about], 3);
  t('a replaced top is kept under the push', layers(swapped.shown), ['home:hidden', '7:exit', '8:enter']);
  const below = tr.stepFor(atRest([agent, settings]), [settings], 4);
  t('a change under the top: no motion, at rest', [below.kind, below.rest, layers(below.shown).join(' ')], ['same', true, 'home:hidden 7:top']);
  const midPush = tr.stepFor(atRest([]), [settings], 5).shown;
  const underMotion = tr.stepFor(midPush, [agent, settings], 6);
  t('a change under the top while it moves: the motion goes on', [underMotion.kind, underMotion.rest, underMotion.shown.anim.id], ['same', false, 5]);
  const backMidPush = tr.stepFor(midPush, [], 7);
  t('Back while a page comes in: it leaves over Home', [backMidPush.kind, backMidPush.anim.leaving.key, backMidPush.anim.reveal], ['pop', 7, 'home']);
  t('the next motion starts from where things are', layers(tr.stepFor(back.shown, [about], 8).shown), ['home:exit', '8:enter']);
  t('below the top: the one under it, or none on Home', [tr.belowOf([agent, settings]), tr.belowOf([settings]), tr.belowOf([])], ['1', 'home', '']);

  // --- A-01's face -----------------------------------------------------------
  const f = await import(src('ui/common/face/mood.ts'));
  t('running is awake', f.moodOf('ready'), 'awake');
  t('starting is busy', f.moodOf('starting'), 'busy');
  t('installing is busy whatever the engine', f.moodOf('stopped', true), 'busy');
  t('failed is oops', [f.moodOf('failed'), f.moodOf('died')], ['oops', 'oops']);
  t('no status is asleep', f.moodOf(undefined), 'asleep');
  const crew = [{ id: 'b', createdAt: 5 }, { id: 'a', createdAt: 1 }, { id: 'c', createdAt: 9 }];
  t('serials by age', ['a', 'b', 'c'].map((id) => f.agentSerial(crew, id)), ['A-01', 'A-02', 'A-03']);
  t('poses take turns', ['A-01', 'A-02', 'A-03', 'A-04'].map(f.poseOf), ['square', 'wide', 'tall', 'square']);
  const l = await import(src('ui/common/face/lines.ts'));
  t('crew line', [l.crewLine(3, 1), l.crewLine(1, 0), l.crewLine(0, 0)], ['3 agents · 1 awake', '1 agent · all asleep', 'nobody home yet']);
  t('boops take turns and wrap', [l.boopLine(0), l.boopLine(l.BOOPS.length)], [l.BOOPS[0], l.BOOPS[0]]);
  t('captions fit the site\'s 17 characters', [...l.BOOPS, ...l.WAKING].every((x) => x.length <= 17), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// The RAM warning and the caps: when the warning speaks up
// (src/state/logic/memoryEpisode.ts), what it lists and says
// (src/ui/memory/logic/), and the caps' choices and the Settings hub
// (src/ui/settings/logic/). Imports the real pure modules (Node 22.18+
// strips their types), so these cannot drift.
// Run: node test_memory.js (or pnpm check:vectors)
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

const MB = 1e6;
const GB = 1e9;
const MIN = 60_000;

(async () => {
  // --- the episode: when the warning opens by itself ------------------------
  const e = await import(src('state/logic/memoryEpisode.ts'));
  const read = (level, lastAutoStop = null) => ({ level, lastAutoStop });
  let f = e.foldReading(e.NO_EPISODE, read('ok'), 1000);
  t('ok at launch: nothing opens', [f.open, f.told], [false, null]);
  f = e.foldReading(f.episode, read('warn'), 2000);
  t('warn starts an episode: it opens', [f.open, f.episode.shownAt], [true, 'warn']);
  f = e.foldReading(f.episode, read('warn'), 7000);
  t('the next warn reading does not nag', f.open, false);
  f = e.foldReading(f.episode, read('critical'), 12000);
  t('turning critical opens it once more', [f.open, f.episode.shownAt], [true, 'critical']);
  f = e.foldReading(f.episode, read('warn'), 17000);
  t('back down to warn: quiet', f.open, false);
  f = e.foldReading(f.episode, read('critical'), 22000);
  t('critical again in the same episode: quiet', f.open, false);
  f = e.foldReading(f.episode, read('ok'), 30000);
  t('ok: the episode settles', [f.open, f.episode.okSince], [false, 30000]);
  const bounce = e.foldReading(f.episode, read('warn'), 30000 + MIN);
  t('a bounce within the settle time is the same episode', bounce.open, false);
  const fresh = e.foldReading(f.episode, read('warn'), 30000 + e.SETTLE_MS);
  t('after the settle time a new episode opens it', [fresh.open, fresh.episode.shownAt], [true, 'warn']);
  const okAgain = e.foldReading(f.episode, read('ok'), 30000 + 2 * MIN);
  t('more ok readings keep when it settled', okAgain.episode.okSince, 30000);

  // Automatic stops: told once.
  const stop = { at: 50_000, agentIds: ['a2'], modelIds: [] };
  const first = e.foldReading(e.NO_EPISODE, read('warn', stop), 50_000 + MIN);
  t('a recent stop on the first reading is told', first.told, stop);
  const again = e.foldReading(first.episode, read('warn', stop), 50_000 + 2 * MIN);
  t('the same stop is not told twice', again.told, null);
  const old = e.foldReading(e.NO_EPISODE, read('ok', stop), 50_000 + e.RECENT_STOP_MS + 1);
  t('an old stop on the first reading is not told', [old.told, old.episode.toldStopAt], [null, 50_000]);
  const next = { at: 90_000, agentIds: ['a3'], modelIds: ['m'] };
  t('a newer stop is told', e.foldReading(again.episode, read('ok', next), 2 * 60 * MIN).told, next);

  // --- the rows -------------------------------------------------------------
  const r = await import(src('ui/memory/logic/memoryRows.ts'));
  const info = { a1: { name: 'Ada', kindLabel: 'opencode' }, a2: { name: 'Bob', kindLabel: 'Claude Code' } };
  const status = {
    level: 'warn',
    totalBytes: 8 * GB,
    availBytes: 0.8 * GB,
    warnBelowBytes: 0.96 * GB,
    stopAt: 100_000,
    nextStopAgentId: 'a2',
    agents: [
      { agentId: 'a2', bytes: 300 * MB, working: false, lastUsedAt: 1, modelId: 'qwen' },
      { agentId: 'a1', bytes: 600 * MB, working: true, lastUsedAt: 2, modelId: null },
      { agentId: 'gone', bytes: null, working: false, lastUsedAt: 3, modelId: null },
    ],
    models: [{ modelId: 'qwen', name: 'Qwen3.5 4B', bytes: 2.9 * GB, agentIds: ['a2'], ready: true }],
    lastAutoStop: null,
  };
  const rows = r.agentRows(status, info);
  t('agents biggest first, unread last', rows.map((x) => x.name), ['Ada', 'Bob', 'an agent']);
  t('the next one is marked', rows.map((x) => x.next), [false, true, false]);
  t('an agent on a model names it', rows[1].modelName, 'Qwen3.5 4B');
  const models = r.modelRows(status, info);
  t('a model names its agents', models[0].agentNames, ['Bob']);
  t('totals count what was read', r.totalBytes(rows), 900 * MB);
  t('no reading, no total', r.totalBytes([{ bytes: null }]), null);
  const use = r.ramUse(status);
  t('used and free', [use.usedBytes, use.freeBytes, use.usedFraction], [7.2 * GB, 0.8 * GB, 0.9]);
  t('the warn line as a used fraction', use.warnFraction, 0.88);
  t('unmeasured memory: no meter', r.ramUse({ totalBytes: 0, availBytes: 0, warnBelowBytes: 0 }), null);

  // --- what it says ---------------------------------------------------------
  const c = await import(src('ui/memory/logic/memoryCopy.ts'));
  t('clock', [c.clock(42), c.clock(75), c.clock(0), c.clock(4.2)], ['0:42', '1:15', '0:00', '0:05']);
  t('seconds left', [c.secondsLeft(10_500, 0), c.secondsLeft(0, 5000), c.secondsLeft(null, 0)], [11, 0, null]);
  t(
    'warn countdown names who goes',
    c.countdownLine('warn', 42, 'Bob', 2),
    'In 0:42 we tuck Bob in. Better you pick than us.',
  );
  t('critical countdown', c.countdownLine('critical', 12, 'Bob', 2), 'In 0:12 Bob goes to sleep, ready or not.');
  t('countdown at zero', c.countdownLine('warn', 0, 'Bob', 2), 'Tucking Bob in now…');
  t(
    'no countdown with the screen agent only',
    c.countdownLine('warn', null, null, 1),
    "We never stop the agent on your screen, so this one's up to you.",
  );
  t('no countdown line at ok or without agents', [c.countdownLine('ok', 5, 'Bob', 2), c.countdownLine('warn', 5, 'Bob', 0)], [null, null]);
  t('pill', [c.pillText('warn', 42), c.pillText('critical', 9), c.pillText('warn', null)], ['ram tight · 0:42', 'ram sos · 0:09', 'ram tight']);
  t('one headline per seed', c.headline('warn', 3, false), c.headline('warn', 3, false));
  t('recovered says phew', c.headline('ok', 1, true), 'Phew. Room to breathe again');
  t('every level has headlines', ['ok', 'warn', 'critical'].every((l) => c.headline(l, 7, false).length > 0), true);
  t(
    'pitch counts the agents',
    c.pitch('warn', 3, false),
    'Your phone is nearly out of memory with 3 agents running. Put the ones you can spare to sleep.',
  );
  t('names', [c.nameList(['A']), c.nameList(['A', 'B']), c.nameList(['A', 'B', 'C'])], ['A', 'A and B', 'A, B and C']);
  t(
    'told: one agent',
    c.toldText(['Bob'], []),
    'Nap time for Bob: we stopped it to free up memory. Start it again whenever you like.',
  );
  t(
    'told: agents and a model',
    c.toldText(['Bob', 'Cy'], ['Qwen']),
    'Nap time for Bob and Cy: we stopped them and unloaded Qwen to free up memory. Start them again whenever you like.',
  );
  t('told: a model only', c.toldText([], ['Qwen']), 'We unloaded Qwen to free up memory.');
  t('ram line', c.ramLine(use), '800 MB free of 8 GB');
  t('ram hint', c.ramHint(0.96 * GB), 'we start to sweat under 960 MB free');

  const w = await import(src('ui/memory/logic/rowText.ts'));
  t('agent line', w.agentLine(rows[1]), 'Claude Code · 300 MB · idle · on Qwen3.5 4B');
  t('agent line without a reading', w.agentLine(rows[2]), 'idle');
  t('model line', w.modelLine(models[0]), '2.9 GB · loaded · 1 agent on it');
  t('a model with no agents just stops', w.modelStopConfirm('Qwen', []), null);
  t(
    'a model with one agent asks',
    w.modelStopConfirm('Qwen', ['Bob']),
    'Stopping Qwen stops Bob first. Nothing is lost: it just naps until you start it again.',
  );
  t(
    'a model with agents names them',
    w.modelStopConfirm('Qwen', ['Bob', 'Cy']),
    'Stopping Qwen stops 2 agents (Bob and Cy) first. Nothing is lost: they just nap until you start them again.',
  );
  t('confirm button', [w.modelStopAll(1), w.modelStopAll(3)], ['Stop both', 'Stop them all']);
  t('agents box line', w.agentsBoxLine(2, 900 * MB), '2 agents running · 900 MB together');

  // --- the caps -------------------------------------------------------------
  const k = await import(src('ui/settings/logic/caps.ts'));
  t('agents offered', k.capOptions('agents', null), [null, 1, 2, 3, 4, 5, 6, 8]);
  t('a saved cap we do not offer joins in order', k.capOptions('agents', 7), [null, 1, 2, 3, 4, 5, 6, 7, 8]);
  t('models offered', k.capOptions('models', 2), [null, 1, 2, 3]);
  t('chips', [k.capChip(null), k.capChip(3)], ['∞', '3']);
  t('names', [k.capName('agents', null), k.capName('agents', 1), k.capName('models', 1), k.capName('agents', 12)], [
    'go wild',
    'monk mode',
    'one big brain',
    '12 at once',
  ]);
  t('no caps line', k.capsLine({ maxAgents: null, maxModels: null }), '∞ agents · ∞ models · no caps');
  t('caps line', k.capsLine({ maxAgents: 2, maxModels: 1 }), '2 agents · 1 model at most');
  t('every note says something', [k.capNote('agents', null), k.capNote('agents', 1), k.capNote('models', 2)].every((n) => n.length > 40), true);

  // --- the Settings hub ------------------------------------------------------
  const h = await import(src('ui/settings/logic/hub.ts'));
  const facts = {
    channel: 'full',
    themeMode: 'system',
    extraKeysSticky: false,
    limits: { maxAgents: null, maxModels: null },
    telemetry: true,
    version: '1.2.3',
  };
  const hub = h.hubRows(facts);
  t('hub order: phone control is not a row', hub.map((x) => x.target), ['look', 'agents', 'privacy', 'updates', 'about']);
  t('every row says what is inside', hub.every((x) => x.line.length > 0 && x.now.length > 0), true);
  t('privacy now', hub[2].now, 'usage stats on');
  t('kickers follow the hub', [h.pageKicker('look'), h.pageKicker('updates')], ['settings · 01', 'settings · 04']);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

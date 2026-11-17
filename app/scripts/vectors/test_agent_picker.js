// New agent's Choose agent step (src/ui/env/new-agent/picker/): the
// applicants' faces (logic/applicants.ts), the stats and meters the
// showcase shows, who sits out and what a screen reader hears
// (logic/facts.ts), what each costs to play (logic/coin.ts), its fans
// (logic/fans.ts), its power move and How to play links
// (logic/howToPlay.ts), and the stat key explaining them (logic/statKey.ts).
// Imports the real pure modules (Node 22.18+ strips their types), so these
// cannot drift.
// Run: node test_agent_picker.js (or pnpm check:vectors)
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
const repo = (...parts) => pathToFileURL(path.join(__dirname, '../../..', ...parts)).href;

// A steady "random": the same picks every run.
function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

(async () => {
  const a = await import(src('ui/env/new-agent/picker/logic/applicants.ts'));
  const f = await import(src('ui/env/new-agent/picker/logic/facts.ts'));
  const c = await import(src('ui/env/new-agent/picker/logic/coin.ts'));
  const fans = await import(src('ui/env/new-agent/picker/logic/fans.ts'));
  const h = await import(src('ui/env/new-agent/picker/logic/howToPlay.ts'));
  const k = await import(src('ui/env/new-agent/picker/logic/statKey.ts'));
  const { METER_MAX } = await import(src('ui/env/new-agent/picker/logic/meter.ts'));
  const l = await import(repo('mascot/look.ts'));
  const p = await import(repo('mascot/pick.ts'));

  // --- applicants' faces ----------------------------------------------------------
  const ids = ['opencode', 'claude-code', 'gemini-cli', 'codex', 'aider'];
  const agents = [{ design: 'plain', shape: 'square', swap: false }];
  const looks = a.applicantLooks(ids, {}, agents, seeded(7));
  const keys = new Set(p.allLooks().map(l.lookKey));
  t('a face for every applicant', Object.keys(looks), ids);
  t(
    'each face is a real look',
    ids.every((id) => keys.has(l.lookKey(looks[id]))),
    true,
  );
  const designs = ids.map((id) => looks[id].design);
  t('no two applicants wear the same design', new Set(designs).size, ids.length);
  t("none wears an agent's design", designs.includes('plain'), false);
  t('nothing new: the same record back', a.applicantLooks(ids, looks, agents, seeded(1)) === looks, true);
  const more = a.applicantLooks([...ids, 'user.mine'], looks, agents, seeded(2));
  t(
    'a kind turning up: the others keep their faces',
    ids.every((id) => l.sameLook(more[id], looks[id])),
    true,
  );
  t("…and the newcomer's design is nobody else's", designs.includes(more['user.mine'].design), false);
  const fewer = a.applicantLooks(ids.slice(1), looks, agents, seeded(3));
  t('a kind gone: dropped', 'opencode' in fewer, false);
  t(
    '…the rest kept',
    ids.slice(1).every((id) => l.sameLook(fewer[id], looks[id])),
    true,
  );
  t('no applicants: an empty record', a.applicantLooks([], {}, agents, seeded(4)), {});

  // --- facts and meters -----------------------------------------------------------
  const about = { checked: '2026-11-17', free: { via: 'models', note: 'Free models on Zen' } };
  const base = {
    id: 'opencode',
    messaging: 'wakes',
    schedules: true,
    canWake: true,
    acp: false,
    models: ['openai-chat'],
    home: 'web',
    about,
  };
  const NOW = Date.now();
  const facts = f.kindFacts(base, NOW);
  t(
    'five facts, in order',
    facts.map((x) => x.term),
    ['Cost', 'Fans', 'Messages', 'Schedules', 'Home'],
  );
  t(
    'a waking kind: full meters, a coin for its cost',
    facts.map((x) => x.meter),
    [null, 3, 3, 3, null],
  );
  t(
    '…in words',
    facts.map((x) => (x.term === 'Fans' ? /^[\d.]+[kM]? stars$/.test(x.value) : x.value)),
    ['free play', true, 'can wake it', 'wakes or starts it', 'web page'],
  );
  t('…the fans with when the crowd was counted', /^Head count taken|^No head count/.test(facts[1].note), true);
  const cheerOf = (id) => f.kindFacts({ ...base, id }, NOW)[1].note.replace(/^Head count taken [^.]*\. /, '');
  const stadium = ['opencode', 'claude-code', 'codex', 'pi', 'gemini-cli'].filter((id) => fans.venueOf(fans.fansOf(id)) === 'stadium');
  t('agents in one venue never share a cheer', new Set(stadium.map(cheerOf)).size, stadium.length);
  t('…its cost a free-play coin, with how far free goes', [facts[0].coin, facts[0].note], [
    'play',
    'Free models on Zen. Or free on a model on this phone.',
  ]);
  const levels = ['wakes', 'delivered', 'inbox', 'none'].map((m) => f.kindFacts({ ...base, messaging: m }, NOW)[2]);
  t(
    'messages: a step down each level',
    levels.map((x) => x.meter),
    [3, 2, 1, 0],
  );
  t(
    '…in words',
    levels.map((x) => x.value),
    ['can wake it', 'delivered', 'inbox only', 'none'],
  );
  const starts = f.kindFacts({ ...base, canWake: false }, NOW)[3];
  t('schedules that only start it: two', [starts.meter, starts.value], [2, 'starts it']);
  const acp = f.kindFacts({ ...base, canWake: false, acp: true }, NOW)[3];
  t('an ACP kind wakes or starts too: three', [acp.meter, acp.value], [3, 'wakes or starts it']);
  const none = f.kindFacts({ ...base, schedules: false }, NOW)[3];
  t('no schedules: empty', [none.meter, none.value], [0, 'none']);
  const bare = f.kindFacts({ ...base, id: 'user.mine', models: [], home: 'tui', about: null }, NOW);
  t(
    'a custom kind with no local model: insert coin, never counted so no fans',
    bare.map((x) => x.term),
    ['Cost', 'Messages', 'Schedules', 'Home'],
  );
  t('…its coin the slot, and what to bring', [bare[0].coin, bare[0].value, bare[0].note], [
    'slot',
    'insert coin',
    'Bring its plan or an API key.',
  ]);
  t('a TUI home: the terminal', bare[3].value, 'terminal');
  const closed = f.kindFacts({ ...base, id: 'cursor-cli' }, NOW)[1];
  t('a kind with no public repo: said so, an empty meter', [closed.term, closed.value, closed.meter], ['Fans', 'no public repo', 0]);
  t(
    'every meter within its max',
    facts.every((x) => x.meter == null || (x.meter >= 0 && x.meter <= METER_MAX)),
    true,
  );

  // --- what it costs to play ------------------------------------------------------
  const kindOf = (via, models) => ({ about: via ? { checked: '2026-11-17', free: { via, note: 'n' } } : null, models });
  t(
    'coins: free models, then a free tier, then a local model, else the slot',
    [kindOf('models', ['x']), kindOf('tier', ['x']), kindOf(null, ['x']), kindOf(null, [])].map(c.coinOf),
    ['play', 'tier', 'local', 'slot'],
  );
  t('a free tier with a local model too: both told', c.costOf(kindOf('tier', ['x'])).note, 'n. Or free on a model on this phone.');
  t('a note that ends its own sentence keeps its stop', c.costOf({ about: { checked: 'x', free: { via: 'tier', note: 'Ask!' } }, models: [] }).note, 'Ask!');
  t('a local model only: where it runs', c.costOf(kindOf(null, ['x'])), {
    coin: 'local',
    value: 'free, local',
    note: 'On a model that runs on this phone.',
  });

  // --- fans -----------------------------------------------------------------------
  t(
    'stars, short',
    [0, 950, 5400, 11421, 29103, 99960, 155942, 227372, 1234567].map(fans.starsText),
    ['0', '950', '5.4k', '11.4k', '29.1k', '100k', '156k', '227k', '1.2M'],
  );
  t(
    'the fans meter: a segment, two past 25k, full past 100k',
    [0, 5400, 24999, 25000, 99999, 100000].map(fans.fansMeter),
    [0, 1, 1, 2, 2, METER_MAX],
  );

  t('fans by kind: a count, null for no repo, undefined never counted', [
    fans.fansOf('a', { a: 5, b: null }),
    fans.fansOf('b', { a: 5, b: null }),
    fans.fansOf('c', { a: 5, b: null }),
    fans.fansOf('constructor', { a: 5 }),
  ], [5, null, undefined, undefined]);
  t(
    'venues: a stadium past 100k, an arena past 25k, a club, a closed door',
    [227000, 100000, 99999, 25000, 5400, 0, null].map(fans.venueOf),
    ['stadium', 'stadium', 'arena', 'arena', 'club', 'club', 'closed'],
  );
  const at = new Date(2026, 10, 17, 9, 5).toISOString();
  const later = (days, h = 0) => new Date(2026, 10, 17 + days, 9 + h, 5).getTime();
  const counts = { big: 300000, bigger: 400000, mid: 30000, small: 900, shut: null };
  t(
    'the head count, when it was taken',
    [later(0), later(0, 3), later(1), later(3)].map((now) => fans.fansNote('big', now, counts, at).replace(/\. .*$/, '.')),
    [
      'Head count taken minutes ago.',
      'Head count taken today at 09:05.',
      'Head count taken yesterday at 09:05.',
      'Head count taken 3 days ago.',
    ],
  );
  t(
    '…then a cheer for its venue, by its rank there: the most stars get the first',
    ['bigger', 'big', 'mid', 'small', 'shut'].map((id) => fans.fansNote(id, later(0, 3), counts, at).replace(/^[^.]*\. /, '')),
    [fans.CHEERS.stadium[0], fans.CHEERS.stadium[1], fans.CHEERS.arena[0], fans.CHEERS.club[0], fans.CHEERS.closed[0]],
  );
  t(
    'a week old: no cheer, the stands may have filled up',
    fans.fansNote('big', later(9), counts, at),
    'Head count taken 17 Nov 2026. The stands may have filled up since.',
  );
  t('…never counted', fans.fansNote('big', later(0), counts, null), 'No head count yet: the crowd is still finding its seats.');

  // --- power move and How to play -------------------------------------------------
  const links = {
    home: 'https://a.example',
    guide: 'https://a.example/docs',
    keys: 'http://a.example/keys',
    plans: 'javascript:alert(1)',
  };
  t(
    'How to play: https pages only, guide first, website last',
    h.playLinks({ checked: 'x', links }).map((l) => [l.key, l.label]),
    [
      ['guide', 'Guide'],
      ['home', 'Website'],
    ],
  );
  t('…none told: none', h.playLinks(null), []);
  t('a power move: what to type and what it does', h.powerMove({ checked: 'x', move: { keys: '/undo', does: 'Takes back' } }), {
    keys: '/undo',
    does: 'Takes back',
  });
  t(
    '…none, or half of one: none',
    [h.powerMove(null), h.powerMove({ checked: 'x' }), h.powerMove({ checked: 'x', move: 'old words' }), h.powerMove({ checked: 'x', move: { keys: '/x' } })],
    [null, null, null, null],
  );

  // --- the stat key ---------------------------------------------------------------
  const key = k.statKey();
  t(
    "the key: the showcase's stats in its order, the power move and VS",
    key.map((x) => x.term),
    ['Cost', 'Fans', 'Messages', 'Schedules', 'Power move', 'VS'],
  );
  t(
    'every coin, in words the cost row uses',
    key[0].rows.map((r) => [r.mark.coin, r.value]),
    [
      ['play', 'free play'],
      ['tier', 'free tier'],
      ['local', 'free, local'],
      ['slot', 'insert coin'],
    ],
  );
  t(
    'fans: each meter step by its stars, and its venue',
    key[1].rows.map((r) => [r.mark.meter, r.value, r.meaning]),
    [
      [3, '100k+ stars', 'A stadium crowd.'],
      [2, '25k+ stars', 'An arena crowd.'],
      [1, 'under 25k stars', 'A club crowd, loyal and loud.'],
      [0, 'no public repo', 'Closed source: nothing to star.'],
    ],
  );
  t('…counted at every build', /counted again with every app build/.test(key[1].note), true);
  t(
    "messages: every level, the showcase's meter and words, the Messages page's meaning",
    key[2].rows.map((r) => [r.mark.meter, r.value, typeof r.meaning]),
    [
      [3, 'can wake it', 'string'],
      [2, 'delivered', 'string'],
      [1, 'inbox only', 'string'],
      [0, 'none', 'string'],
    ],
  );
  t(
    'schedules: every level, best first',
    key[3].rows.map((r) => [r.mark.meter, r.value]),
    [
      [3, 'wakes or starts it'],
      [2, 'starts it'],
      [0, 'none'],
    ],
  );
  t(
    "every schedule level is one the showcase can show",
    [f.scheduleLevel({ schedules: true, canWake: true, acp: false }), f.scheduleLevel({ schedules: true, canWake: false, acp: true }), f.scheduleLevel({ schedules: true, canWake: false, acp: false }), f.scheduleLevel({ schedules: false, canWake: true, acp: true })],
    ['wakes', 'wakes', 'starts', 'none'],
  );
  t("the power move: a real one, typed in the agent's own app", [key[4].rows[0].mark.input, /own app/.test(key[4].rows[0].meaning)], ['/undo', true]);

  // --- VS mode --------------------------------------------------------------------
  const vs = await import(src('ui/env/new-agent/picker/logic/vs.ts'));
  const fighter = (over) => ({
    id: 'user.a',
    messaging: 'wakes',
    schedules: true,
    canWake: true,
    acp: false,
    models: [],
    home: 'tui',
    about: null,
    ...over,
  });
  const p1 = fighter({ id: 'opencode', models: ['x'], home: 'web', about: { checked: 'x', free: { via: 'models', note: 'n' }, move: { keys: '/agent', does: 'd' } } });
  const p2 = fighter({ id: 'cursor-cli', messaging: 'inbox', canWake: false, about: { checked: 'x', move: { keys: '& task', does: 'd' } } });
  const rows = vs.vsRows(p1, p2);
  t(
    "VS: the showcase's stats, then home and the moves",
    rows.map((r) => r.term),
    ['Cost', 'Fans', 'Messages', 'Schedules', 'Home', 'Move'],
  );
  t(
    '…who takes each: free play beats insert coin, any stars beat no repo, a wake beats an inbox',
    rows.map((r) => r.winner),
    ['left', 'left', 'left', 'left', null, null],
  );
  t('…each side in its own words', [rows[0].left.value, rows[0].right.value, rows[1].right.value, rows[5].right.value], [
    'free play',
    'insert coin',
    'no public repo',
    '& task',
  ]);
  t('…even stats are a tie', vs.vsRows(fighter({}), fighter({ id: 'user.b' })).map((r) => r.winner), ['tie', 'tie', 'tie', null]);
  t('…a custom kind never counted: no fans row, no moves row', vs.vsRows(fighter({}), p1).map((r) => r.term), ['Cost', 'Messages', 'Schedules', 'Home']);
  const score = vs.vsScore(rows);
  t('the score counts the stats taken', score, { left: 4, right: 0 });
  t('…and the verdict', [vs.vsVerdict(score), vs.vsVerdict({ left: 1, right: 2 }), vs.vsVerdict({ left: 1, right: 1 })], ['pick', 'challenger', 'draw']);
  const copy = await import(src('ui/env/new-agent/picker/copy.ts'));
  t(
    '…said with real names, never P1 or P2',
    [copy.verdictText('pick', 'opencode', 'Codex'), copy.verdictText('challenger', 'opencode', 'Codex'), copy.verdictText('draw', 'opencode', 'Codex'), copy.vsHead('opencode', 'Codex')],
    ['opencode wins', 'Codex wins', 'Draw', 'opencode vs Codex'],
  );
  t(
    'a screen reader hears both sides and who takes it',
    vs.vsRowLabel(rows[0], 'opencode', 'Cursor CLI'),
    'Cost: opencode free play, Cursor CLI insert coin; opencode takes it',
  );

  // --- sitting out ----------------------------------------------------------------
  const offers = [
    { label: 'opencode', blocked: null },
    { label: 'Aider', blocked: 'needs_linux' },
    { label: 'Cline', blocked: 'needs_linux' },
    { label: 'Mine', blocked: 'family' },
  ];
  t('a line per reason, names in order', f.sittingOut(offers), [
    'Needs a Linux env: Aider, Cline',
    "Can't be installed on this env's OS: Mine",
  ]);
  t('everyone can: no lines', f.sittingOut([offers[0]]), []);

  // --- what a screen reader hears -------------------------------------------------
  const kind = { messaging: 'delivered', schedules: true, canWake: false, acp: false, about: null, models: [] };
  t(
    'a pickable one: name, badges, messages, schedules',
    f.applicantLabel({ label: 'Mine', origin: 'user', stability: 'preview', blocked: null }, kind),
    'Mine, Custom, Preview, Messages · delivered, Schedules · starts it',
  );
  t(
    'a free one: how it plays free',
    f.applicantLabel({ label: 'opencode', origin: 'bundled', stability: 'stable', blocked: null }, { ...kind, models: ['x'] }),
    'opencode, Free on a local model, Messages · delivered, Schedules · starts it',
  );
  t(
    'a blocked one: and why',
    f.applicantLabel({ label: 'Aider', origin: 'bundled', stability: 'stable', blocked: 'needs_linux' }, kind),
    'Aider, Messages · delivered, Schedules · starts it, Needs a Linux env',
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

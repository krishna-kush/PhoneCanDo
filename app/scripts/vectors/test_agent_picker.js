// New agent's Choose agent step (src/ui/env/new-agent/picker/): the
// applicants' faces (logic/applicants.ts), and the stats and meters the
// showcase shows, who sits out and what a screen reader hears
// (logic/facts.ts).
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
  const base = { messaging: 'wakes', schedules: true, canWake: true, acp: false, models: ['openai-chat'], home: 'web' };
  const facts = f.kindFacts(base);
  t(
    'four facts, in order',
    facts.map((x) => x.term),
    ['Messages', 'Schedules', 'Local models', 'Home'],
  );
  t(
    'a waking kind: full meters',
    facts.map((x) => x.meter),
    [3, 3, 3, null],
  );
  t(
    '…in words',
    facts.map((x) => x.value),
    ['can wake it', 'wakes or starts it', 'yes', 'web page'],
  );
  const levels = ['wakes', 'delivered', 'inbox', 'none'].map((m) => f.kindFacts({ ...base, messaging: m })[0]);
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
  const starts = f.kindFacts({ ...base, canWake: false })[1];
  t('schedules that only start it: two', [starts.meter, starts.value], [2, 'starts it']);
  const acp = f.kindFacts({ ...base, canWake: false, acp: true })[1];
  t('an ACP kind wakes or starts too: three', [acp.meter, acp.value], [3, 'wakes or starts it']);
  const none = f.kindFacts({ ...base, schedules: false })[1];
  t('no schedules: empty', [none.meter, none.value], [0, 'none']);
  const tui = f.kindFacts({ ...base, models: [], home: 'tui' });
  t('no local models: empty', [tui[2].meter, tui[2].value], [0, 'no']);
  t('a TUI home: the terminal', tui[3].value, 'terminal');
  t(
    'every meter within its max',
    facts.every((x) => x.meter == null || (x.meter >= 0 && x.meter <= f.METER_MAX)),
    true,
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
  const kind = { messaging: 'delivered', schedules: true, canWake: false, acp: false };
  t(
    'a pickable one: name, badges, messages, schedules',
    f.applicantLabel({ label: 'Mine', origin: 'user', stability: 'preview', blocked: null }, kind),
    'Mine, Custom, Preview, Messages · delivered, Schedules · starts it',
  );
  t(
    'a blocked one: and why',
    f.applicantLabel({ label: 'Aider', origin: 'bundled', stability: 'stable', blocked: 'needs_linux' }, kind),
    'Aider, Messages · delivered, Schedules · starts it, Needs a Linux env',
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

// A system's agents line on the Systems page
// (src/ui/env/logic/systemAgents.ts). Imports the real pure module (Node
// 22.18+ strips its types), so it cannot drift.
// Run: node test_system_agents.js (or pnpm check:vectors)
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
  const a = await import(src('ui/env/logic/systemAgents.ts'));

  const rows = [
    { image: { state: 'ready' }, agents: [{ name: 'opencode' }, { name: 'claude' }] },
    { image: { state: 'creating' }, agents: [{ name: 'gemini' }] },
    { image: null, agents: [{ name: 'lost' }] },
  ];
  t('agents line', [a.systemAgentsLine([]), a.systemAgentsLine(rows.slice(0, 1)), a.systemAgentsLine(rows)], [
    'no agents',
    '2 agents',
    '4 agents · 1 setting up',
  ]);
  t('one agent', a.systemAgentsLine([{ image: { state: 'ready' }, agents: [{}] }]), '1 agent');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

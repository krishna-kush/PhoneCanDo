// The drawer key's three bunks (src/ui/drawer/key/logic/bunks.ts): who lies
// in each, in which ink, eyes open or shut, and what a screen reader says.
// Imports the real pure module (Node 22.18+ strips its types), so these
// cannot drift.
// Run: node test_drawer_bunks.js (or pnpm check:vectors)
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
  const b = await import(src('ui/drawer/key/logic/bunks.ts'));
  const crew = (name, ink, mood) => ({ name, ink, mood });
  const sleeper = (ink) => ({ ink, awake: false });

  t('always three bunks', [0, 1, 2, 3, 5].map((n) => b.bunksOf(Array.from({ length: n }, (_, i) => crew(`a${i}`, 'red', 'awake'))).length), [3, 3, 3, 3, 3]);
  t('nobody in: three sleeping, red on top', b.bunksOf([]), [sleeper('red'), sleeper('amber'), sleeper('red')]);
  t('one red agent: then amber, then red', b.bunksOf([crew('kay', 'red', 'awake')]), [{ ink: 'red', awake: true }, sleeper('amber'), sleeper('red')]);
  t('one amber agent: then red, then amber', b.bunksOf([crew('kay', 'amber', 'asleep')]), [sleeper('amber'), sleeper('red'), sleeper('amber')]);
  t('two amber agents: an empty bunk takes red', b.bunksOf([crew('a', 'amber', 'asleep'), crew('b', 'amber', 'asleep')]).map((x) => x.ink), ['amber', 'amber', 'red']);
  t('four agents: the first three, in order', b.bunksOf([crew('a', 'red', 'awake'), crew('b', 'amber', 'asleep'), crew('c', 'amber', 'awake'), crew('d', 'red', 'awake')]), [
    { ink: 'red', awake: true },
    { ink: 'amber', awake: false },
    { ink: 'amber', awake: true },
  ]);

  t('eyes open: awake, thinking, busy', ['awake', 'thinking', 'busy'].map(b.eyesOpen), [true, true, true]);
  t('eyes shut: asleep, oops', ['asleep', 'oops'].map(b.eyesOpen), [false, false]);
  t('a swapped look puts amber in front', [b.inkOf({ swap: false }), b.inkOf({ swap: true })], ['red', 'amber']);

  t('label with nobody in', b.keyLabel([]), 'Open the menu: agents, models, settings');
  t('label names the bunks', b.keyLabel([crew('kay', 'red', 'awake'), crew('riya', 'amber', 'asleep')]), 'Open the menu: agents, models, settings. kay awake. riya asleep');
  t('label: only the three in bunks', b.keyLabel([crew('a', 'red', 'awake'), crew('b', 'red', 'awake'), crew('c', 'red', 'awake'), crew('d', 'red', 'awake')]), 'Open the menu: agents, models, settings. a awake. b awake. c awake');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

// A model's Memory setting (src/ui/models/logic/memory.ts): the shares and
// what each lets the model take, the planner's line, the Advanced counts,
// the note size choices, the count chips and their notes, the button and
// whether anything changed; and the Server log page's Detailed log switch
// (src/ui/models/logic/detailedLog.ts). Imports the real pure modules (Node
// 22.18+ strips their types), so these cannot drift.
// Run: node test_model_memory.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name} got=${q(got)} want=${q(want)}`);
}
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;

const GB = 1e9;
const plan = (over) => ({
  context: 32_768,
  halfKvCache: false,
  savedPrompts: 2,
  checkpoints: 4,
  threads: 4,
  totalBytes: 3.3 * GB,
  ram: { verdict: 'fits', needBytes: 2.6 * GB, budgetBytes: 3.9 * GB },
  storedChats: 0,
  measured: true,
  ...over,
});
const traits = (over) => ({
  savedPrompts: { min: 0, max: 3, auto: 2 },
  checkpoints: { min: 2, max: 8, auto: 4 },
  halfKvCache: true,
  threads: { min: 1, max: 8, auto: 4 },
  budgets: { less: 2.56 * GB, normal: 3.87 * GB, more: 5.11 * GB },
  ...over,
});

(async () => {
  const m = await import(src('ui/models/logic', 'memory.ts'));
  const auto = m.AUTO_MEMORY;

  // --- the share ---------------------------------------------------------------
  const shares = m.shareOptions(traits({}).budgets);
  t('three shares', shares.map((o) => [o.value, o.label]), [['less', 'Less'], ['normal', 'Normal'], ['more', 'More']]);
  t('less names its cap', shares[0].note, "About a third of this phone's RAM, up to 2.6 GB: other apps keep more.");
  t('normal names its cap', shares[1].note, 'About half, up to 3.9 GB.');
  t('more warns', shares[2].note.startsWith('About two thirds, up to 5.1 GB: Android may close other apps sooner'), true);

  // --- the planner's line --------------------------------------------------------
  t('line', m.planLine(plan({})), 'On this phone: context 32k · 2 chats saved · 3.3 GB');
  t('line, half-size notes', m.planLine(plan({ halfKvCache: true, savedPrompts: 0 })), 'On this phone: context 32k · no chats saved · half-size notes · 3.3 GB');
  t('line, one chat', m.planLine(plan({ savedPrompts: 1, context: 65_536 })), 'On this phone: context 64k · 1 chat saved · 3.3 GB');
  t('saved words', [0, 1, 2, 3, NaN].map(m.savedText), ['no chats saved', '1 chat saved', '2 chats saved', '3 chats saved', 'no chats saved']);
  // When free memory, not the share, is the limit, a second line says so; otherwise none.
  t('free memory limits', m.freeLimitLine(plan({ freeMemoryLimits: true })), 'Limited by free memory now: stopping other agents or apps gives it more.');
  t('the share limits', m.freeLimitLine(plan({ freeMemoryLimits: false })), '');
  // Fewer than 2 saved chats: chats that take turns read their prompts again; a line says so.
  t('one saved', m.savedChatsLine(plan({ savedPrompts: 1 }), 2), '1 chat saved: chats that take turns (an agent and its helper, or two agents) need 2, so each switch reads the prompt again.');
  t('none saved', m.savedChatsLine(plan({ savedPrompts: 0 }), 2), 'No chat can be saved now: each switch between chats reads the prompt again.');
  t('one saved of one chosen', m.savedChatsLine(plan({ savedPrompts: 1 }), 1), m.ONE_SAVED_LINE);
  t('two saved, no line', m.savedChatsLine(plan({ savedPrompts: 2 }), 2), '');
  t('three saved, no line', m.savedChatsLine(plan({ savedPrompts: 3 }), 3), '');
  t('none asked for, no line', m.savedChatsLine(plan({ savedPrompts: 0 }), 0), '');

  // --- chats on storage, and the estimate before a first measurement -------------------
  const stored = plan({ storedChats: 4, savedPrompts: 0 });
  t('line, chats on storage', m.planLine(stored), 'On this phone: context 32k · chats on storage · 3.3 GB');
  t('storage line in place of the RAM ones', m.savedChatsLine(stored, 2), 'Chats that take turns are kept on storage (up to 4), so switching between them takes about a second.');
  t('storage line, none asked for in RAM', m.savedChatsLine(stored, 0), m.storedChatsLine(4));
  t('storage off: the RAM lines', m.savedChatsLine(plan({ storedChats: 0, savedPrompts: 0 }), 2), m.NONE_SAVED_LINE);
  t('line, an estimate', m.planLine(plan({ measured: false })), 'On this phone: context 32k · 2 chats saved · about 3.3 GB');
  t('estimate line', m.ESTIMATE_LINE, 'An estimate until the model first starts on this phone: then it counts what its server measures.');
  t('refused only when too big', [null, plan({}), plan({ ram: { verdict: 'too_big', needBytes: 1, budgetBytes: 0 } }), plan({ ram: { verdict: 'over_budget', needBytes: 1, budgetBytes: 0 } })].map(m.refused), [false, false, true, false]);

  // --- Advanced counts, the button, changes --------------------------------------
  t('all auto', m.advancedCount(auto, null), 0);
  t('a chosen context counts', m.advancedCount(auto, 65_536), 1);
  t('every choice counts', m.advancedCount({ ramShare: 'more', kvCache: 'half', savedPrompts: 0, checkpoints: 8, threads: 2 }, 32_768), 5);
  t('the share is not advanced', m.advancedCount({ ...auto, ramShare: 'less' }, null), 0);
  t('count words', [0, 2].map(m.advancedCountText), ['', '2 set']);
  t('button, auto', m.memoryButtonText({ memory: auto, contextChoice: null }), 'Memory: Normal');
  t('button, more and two set', m.memoryButtonText({ memory: { ...auto, ramShare: 'more', threads: 2 }, contextChoice: 65_536 }), 'Memory: More · 2 set');
  const saved = { context: null, memory: auto };
  t('nothing changed', m.memoryChanged(saved, { context: null, memory: { ...auto } }), false);
  t('the context changed', m.memoryChanged(saved, { context: 32_768, memory: auto }), true);
  t('a choice changed', m.memoryChanged(saved, { context: null, memory: { ...auto, savedPrompts: 0 } }), true);
  t('the share changed', m.memoryChanged(saved, { context: null, memory: { ...auto, ramShare: 'less' } }), true);

  // --- note size -------------------------------------------------------------------
  const sizes = m.noteSizeOptions(traits({}), true);
  t('auto, full, half', sizes.map((o) => o.value), ['auto', 'full', 'half']);
  t('auto says what it picks now', sizes[0].note, 'Half size only when full size would not leave room for 32k of context: half now.');
  t('auto says nothing when it is not the choice', m.noteSizeOptions(traits({}), null)[0].note, 'Half size only when full size would not leave room for 32k of context.');
  const plain = m.noteSizeOptions(traits({ halfKvCache: false }), false);
  t('no half for heads that cannot be 8-bit', plain.map((o) => o.value), ['auto', 'full']);
  t('auto is full then', plain[0].note, 'Full size: this model cannot use half-size notes.');

  // --- counts ------------------------------------------------------------------------
  t('saved chips', m.countOptions({ min: 0, max: 3, auto: 2 }).map(m.countChip), ['Auto', '0', '1', '2', '3']);
  t('snapshot chips', m.countOptions({ min: 2, max: 8, auto: 4 }), [null, 2, 3, 4, 5, 6, 7, 8]);
  t('thread chips', m.countOptions({ min: 1, max: 4, auto: 4 }), [null, 1, 2, 3, 4]);
  const savedCount = traits({}).savedPrompts;
  t('saved, auto', m.countNote('saved', null, savedCount).startsWith('Auto: 2. Chats the model'), true);
  t('saved, none turns it off', m.countNote('saved', 0, savedCount).endsWith('; none turns this off.'), true);
  t('saved, a number has no auto', m.countNote('saved', 3, savedCount).startsWith('Chats the model'), true);
  // What fits now, beside the Auto value or a chosen count.
  t('fits words', [0, 1, 2, NaN].map(m.fitsNowText), ['none fit now', '1 fits now', '2 fit now', 'none fit now']);
  t('auto, none fit now', m.countNote('saved', null, savedCount, 0).startsWith('Auto: 2 · none fit now. Chats the model'), true);
  t('auto, one fits now', m.countNote('saved', null, savedCount, 1).startsWith('Auto: 2 · 1 fits now. '), true);
  t('three chosen, two fit now', m.countNote('saved', 3, savedCount, 2).startsWith('2 fit now. Chats the model'), true);
  t('none chosen, nothing to fit', m.countNote('saved', 0, savedCount, 0).startsWith('Chats the model'), true);
  t('a chat counts at half the context', m.countNote('saved', null, savedCount).includes('a chat at half the context'), true);
  t('fits only for saved chats', m.countNote('threads', null, traits({}).threads, 1).startsWith('Auto: 4. '), true);
  t('saved, chats on storage', m.countNote('saved', null, savedCount, 0, true).startsWith(`${m.SAVED_ON_STORAGE_NOTE} Auto: 2. Chats the model`), true);
  t('on storage says so first', m.SAVED_ON_STORAGE_NOTE, 'Chats go to storage now, so none is kept in RAM; this counts only when storage runs short.');
  t('storage only for saved chats', m.countNote('threads', null, traits({}).threads, null, true).startsWith('Auto: 4. '), true);
  t('snapshots, auto', m.countNote('snapshots', null, traits({}).checkpoints).startsWith('Auto: 4. Points near the end of a chat'), true);
  t('threads, auto', m.countNote('threads', null, traits({}).threads), "Auto: 4. This phone's fast cores. More is not always faster: a slow core holds the others back.");
  t('threads, two', m.countNote('threads', 2, traits({}).threads), 'More is not always faster: a slow core holds the others back.');

  // --- the Server log page's switch --------------------------------------------------
  const sl = await import(src('ui/models/logic', 'detailedLog.ts'));
  t('switch title', sl.DETAILED_LOG_TITLE, 'Detailed log');
  t('on says the log holds prompt text', sl.detailedLogNote(true).startsWith('On: ') && sl.detailedLogNote(true).includes('The log then holds prompt text.'), true);
  t('on says a change restarts', sl.detailedLogNote(true).endsWith('The log then holds prompt text. Changing it restarts the model.'), true);
  t('off says a change restarts', sl.detailedLogNote(false).startsWith('Off. On, ') && sl.detailedLogNote(false).endsWith('Changing it restarts the model.'), true);
  // The line under the switch while agents run on the model, as the Memory setting shows it.
  const cx = await import(src('ui/models/logic', 'context.ts'));
  const agents = [{ id: 'a', name: 'Main', model: 'qwen' }, { id: 'b', name: 'Helper', model: 'qwen' }, { id: 'c', name: 'Other', model: 'gemma' }];
  const running = cx.runningOn('qwen', agents, { a: { state: 'ready' }, b: { state: 'starting' }, c: { state: 'ready' } });
  t('the agents a change restarts', cx.restartNote(running), 'Saving restarts Main and Helper, which run on this model.');
  t('none running, no line', cx.restartNote(cx.runningOn('qwen', agents, {})), '');
  t('a switch names its act', cx.restartNote(['Main'], 'Changing it'), 'Changing it restarts Main, which runs on this model.');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

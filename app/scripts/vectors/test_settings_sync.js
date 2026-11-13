// Settings that follow a signed-in person (src/state/logic/settingsSync/):
// which settings, the check on a value read back from the account, what a
// phone sends, and which of the account's settings it takes (only ones
// changed later than here; a tie is the same change). Imports the real pure
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_settings_sync.js (or pnpm check:vectors)
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
  const k = await import(src('state/logic/settingsSync/keys.ts'));
  const m = await import(src('state/logic/settingsSync/merge.ts'));

  t('synced keys', k.SYNCED_KEYS, ['themeMode', 'extraKeysSticky', 'updatePromptMuted', 'maxAgents', 'maxModels']);
  t('prefs + caps cover every synced key', [...k.PREF_KEYS, ...k.CAP_KEYS].sort(), [...k.SYNCED_KEYS].sort());

  t('theme: known modes', ['system', 'light', 'dark'].map((v) => k.settingValue('themeMode', v)), ['system', 'light', 'dark']);
  t('theme: anything else', ['sepia', 1, null, true].map((v) => k.settingValue('themeMode', v)), [undefined, undefined, undefined, undefined]);
  t('switches: booleans only', [true, false, 'true', 0, null].map((v) => k.settingValue('extraKeysSticky', v)), [true, false, undefined, undefined, undefined]);
  t('caps: null or 1..99 whole', [null, 1, 4, 99].map((v) => k.settingValue('maxAgents', v)), [null, 1, 4, 99]);
  t('caps: not a cap', [0, -1, 2.5, 100, '3', true].map((v) => k.settingValue('maxModels', v)), [undefined, undefined, undefined, undefined, undefined, undefined]);

  const values = { themeMode: 'dark', extraKeysSticky: true, updatePromptMuted: false, maxAgents: 3, maxModels: null };
  t('outgoing: every setting, 0 where never changed here', m.outgoing(values, { themeMode: 500, maxAgents: 700 }), {
    themeMode: { value: 'dark', at: 500 },
    extraKeysSticky: { value: true, at: 0 },
    updatePromptMuted: { value: false, at: 0 },
    maxAgents: { value: 3, at: 700 },
    maxModels: { value: null, at: 0 },
  });

  const account = {
    themeMode: { value: 'light', at: 900 }, // later than here: taken
    extraKeysSticky: { value: false, at: 0 }, // a tie with never changed: kept as is
    updatePromptMuted: { value: true, at: 400 }, // never changed here: taken
    maxAgents: { value: 2, at: 700 }, // the same change: nothing moves
    maxModels: { value: 'lots', at: 999 }, // not a cap: left alone
    somethingNew: { value: 1, at: 999 }, // a setting this build doesn't know
  };
  t('incoming: later and understood only', m.incoming(account, { themeMode: 500, maxAgents: 700 }), [
    { key: 'themeMode', value: 'light', at: 900 },
    { key: 'updatePromptMuted', value: true, at: 400 },
  ]);
  t('incoming: nothing when this phone is newer', m.incoming({ themeMode: { value: 'light', at: 100 } }, { themeMode: 200 }), []);
  t('incoming: a new phone takes every changed setting', m.incoming({ themeMode: { value: 'dark', at: 1 }, maxModels: { value: null, at: 5 } }, {}), [
    { key: 'themeMode', value: 'dark', at: 1 },
    { key: 'maxModels', value: null, at: 5 },
  ]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

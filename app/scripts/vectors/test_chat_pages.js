// Web UI page memory (src/ui/chat/lastPage.ts): splitting an engine URL,
// remembering an agent's last page and where a fresh view restores to. Then
// the chat a TUI names in its terminal title (src/engine/agents/chatTitle.ts)
// with opencode's chatTitle from its manifest. The web adapter's chat ids
// are in test_web_adapter.js. Imports the real pure modules (Node 22.18+
// strips their types), so these cannot drift.
// Run: node test_chat_pages.js (or pnpm check:vectors)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name} got=${q(got)} want=${q(want)}`);
}
// import() wants a URL: a bare Windows path (C:\...) is not one.
const mod = pathToFileURL(path.join(__dirname, '../../src/ui/chat/lastPage.ts')).href;

(async () => {
  const { splitUrl, rememberPage, lastPage, restoreUrl } = await import(mod);
  const base = 'http://127.0.0.1:35961';

  t('split path, query and hash', splitUrl(`${base}/L2hvbWU/session/ses_1?x=1#m`), {
    origin: base,
    path: '/L2hvbWU/session/ses_1?x=1#m',
  });
  t('split bare origin', splitUrl(base), { origin: base, path: '/' });
  t('split query without path', splitUrl(`${base}?a=b`), { origin: base, path: '?a=b' });
  t('not http', splitUrl('about:blank'), null);

  t('nothing remembered', lastPage('a1'), null);
  rememberPage('a1', `${base}/L2hvbWU/session/ses_1`);
  rememberPage('a2', 'http://127.0.0.1:43041/');
  t('remembers the path only', lastPage('a1'), '/L2hvbWU/session/ses_1');
  t('per agent', lastPage('a2'), '/');
  rememberPage('a1', 'about:blank');
  t('a non-http page keeps the last one', lastPage('a1'), '/L2hvbWU/session/ses_1');

  t('restore onto the new port', restoreUrl('http://127.0.0.1:40001/', '/L2hvbWU/session/ses_1'),
    'http://127.0.0.1:40001/L2hvbWU/session/ses_1');
  t('no target, stay', restoreUrl(`${base}/`, null), null);
  t('already there, stay', restoreUrl(`${base}/x`, '/x'), null);
  t('only the hash differs, stay', restoreUrl(`${base}/x#a`, '/x#b'), null);
  t('unparsable loaded URL, stay', restoreUrl('about:blank', '/x'), null);

  // opencode's TUI names its chat in the terminal title (its manifest's
  // surfaces.terminal.chatTitle, as the KindView passes it on).
  const { chatTitleOf } = await import(pathToFileURL(path.join(__dirname, '../../src/engine/agents/chatTitle.ts')).href);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../agents/native/opencode/agent.json'), 'utf8'));
  const tuiChatTitle = (title) => chatTitleOf(manifest.surfaces.terminal.chatTitle, title);
  t('TUI chat title', tuiChatTitle('OC | Fix login'), 'Fix login');
  t('TUI cut title kept as shown', tuiChatTitle('OC | Refactor the payment service retries …'), 'Refactor the payment service retries …');
  t('TUI home names no chat', tuiChatTitle('OpenCode'), null);
  t('a shell title names no chat', tuiChatTitle('root@localhost: ~'), null);
  t('a kind without a pattern names no chat', chatTitleOf(null, 'OC | Fix login'), null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

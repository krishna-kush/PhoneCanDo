// Web UI page memory (src/ui/chat/lastPage.ts): splitting an engine URL,
// remembering an agent's last page and where a fresh view restores to.
// Imports the real pure module (Node 22.18+ strips its types), so these
// cannot drift.
// Run: node test_chat_pages.js (or pnpm check:vectors)
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

  // opencode's web adapter: which chat a page shows (src/engine/agents/oc/web.ts).
  const { web } = await import(pathToFileURL(path.join(__dirname, '../../src/engine/agents/oc/web.ts')).href);
  t('chat page', web.sessionOf(`${base}/server/L2hvbWU/session/ses_e4aeb2efc?x=1#m`), 'ses_e4aeb2efc');
  t('chat home is no chat', web.sessionOf(`${base}/server/L2hvbWU`), null);
  t('web home is no chat', web.sessionOf(`${base}/`), null);

  // opencode's TUI names its chat in the terminal title (src/engine/agents/oc/tui.ts).
  const { tuiChatTitle } = await import(pathToFileURL(path.join(__dirname, '../../src/engine/agents/oc/tui.ts')).href);
  t('TUI chat title', tuiChatTitle('OC | Fix login'), 'Fix login');
  t('TUI cut title kept as shown', tuiChatTitle('OC | Refactor the payment service retries …'), 'Refactor the payment service retries …');
  t('TUI home names no chat', tuiChatTitle('OpenCode'), null);
  t('a shell title names no chat', tuiChatTitle('root@localhost: ~'), null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

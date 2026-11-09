// A kind's web adapter (src/engine/agents/webAdapter.ts) built from
// opencode's manifest must produce, byte for byte, what opencode's
// hand-written adapter did before it became data: the goldens in
// fixtures/web-adapter-opencode.json (theme script per mode and palette,
// embed script, auth URLs, chat ids). Then the optional adapter fields.
// Imports the real pure module (Node 22.18+ strips its types), so these
// cannot drift.
// Run: node test_web_adapter.js (or pnpm check:vectors)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${ok ? '' : ` got=${q(got)} want=${q(want)}`}`);
}
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(__dirname, ...parts), 'utf8'));
// import() wants a URL: a bare Windows path (C:\...) is not one.
const mod = pathToFileURL(path.join(__dirname, '../../src/engine/agents/webAdapter.ts')).href;

(async () => {
  const { webUiFor } = await import(mod);
  const golden = readJson('fixtures', 'web-adapter-opencode.json');
  // The manifest the runner reads, as KindView passes its adapter on.
  const manifest = readJson('../../../agents/native/opencode/agent.json');
  const web = webUiFor(manifest.surfaces.web.adapter);

  for (const [key, want] of Object.entries(golden.themeScript)) {
    const [mode, scheme] = key.split('/');
    t(`opencode theme script, ${mode} mode, ${scheme} palette`, web.themeScript(mode, golden.palettes[scheme]), want);
  }
  t('opencode embed script', web.embedScript, golden.embedScript);
  for (const [url, want] of golden.isAuthUrl) t(`isAuthUrl ${q(url)}`, web.isAuthUrl(url), want);
  for (const [url, want] of golden.sessionOf) t(`sessionOf ${q(url)}`, web.sessionOf(url), want);

  // Only cssVars and authUrl are required: no scheme key, nothing hidden, no chats.
  const bare = webUiFor({ cssVars: { '--x': 'fg' }, authUrl: '/login/' });
  const dark = golden.palettes.dark;
  t(
    'without a scheme key the theme script only styles',
    bare.themeScript('dark', dark),
    [
      '(function () {',
      '    try {',
      "      var style = document.getElementById('phonecando-theme');",
      '      if (!style) {',
      "        style = document.createElement('style');",
      "        style.id = 'phonecando-theme';",
      '        (document.head || document.documentElement).appendChild(style);',
      '      }',
      `      style.textContent = ${q(`html:root{background-color:${dark.bg}!important;--x:${dark.fg};}`)};`,
      '    } catch (e) {}',
      '  })();',
      '  true;',
    ].join('\n'),
  );
  t('nothing to hide, no embed style', bare.embedScript, 'true;');
  t('no session pattern, no chat', bare.sessionOf('http://127.0.0.1:1/session/abc'), null);
  t('its own auth URL', bare.isAuthUrl('http://127.0.0.1:1/login/x'), true);
  const many = webUiFor({ cssVars: {}, authUrl: '/a/', hide: ['header', '[data-x="y"]'] });
  t('every hidden selector in one rule', many.embedScript.includes(`style.textContent = 'header,[data-x="y"]{display:none !important}';`), true);

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

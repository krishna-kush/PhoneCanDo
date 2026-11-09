// A kind's web UI inside our WebView, built from its manifest's web adapter
// (KindView.web.adapter): the theme script that maps the app palette onto
// the web UI's CSS variables and color-scheme key, the embed script that
// hides its own chrome, and how its URLs read. Pure (no RN imports); vectors
// in scripts/vectors/test_web_adapter.js hold it byte-equal to what opencode's
// hand-written adapter produced.
import type {
  AgentWebUi,
  WebAdapterSpec,
  WebPalette,
  WebThemeMode,
} from '../../../../agents/kit/ts/contract/web.ts';

export function webUiFor(spec: WebAdapterSpec): AgentWebUi {
  const session = spec.sessionUrl ? new RegExp(spec.sessionUrl) : null;
  return {
    themeScript: (mode, palette) => themeScript(spec, mode, palette),
    embedScript: embedScript(spec.hide ?? []),
    isAuthUrl: (url) => url.includes(spec.authUrl),
    sessionOf: (url) => {
      const m = session?.exec(url);
      return m ? decodeURIComponent(m[1]) : null;
    },
  };
}

// The web UI reads its scheme key before boot and listens for storage events
// after, so the app's mode (`system` included) reaches it either way. The
// palette goes in as CSS variables; only the shell-facing ones are mapped,
// the rest stay the web UI's own. The validator keeps the key and the
// selectors free of quotes, so they sit in the script's string literals as
// they are.
function themeScript(spec: WebAdapterSpec, mode: WebThemeMode, palette: WebPalette): string {
  const value = JSON.stringify(mode);
  const vars = Object.entries(spec.cssVars)
    .map(([name, role]) => `${name}:${palette[role]};`)
    .join('');
  const css = JSON.stringify(`html:root{background-color:${palette.bg}!important;${vars}}`);
  const key = spec.colorSchemeKey;
  const scheme = key
    ? [
        `      localStorage.setItem('${key}', ${value});`,
        "      window.dispatchEvent(new StorageEvent('storage', {",
        `        key: '${key}',`,
        `        newValue: ${value},`,
        '        storageArea: localStorage,',
        '      }));',
      ]
    : [];
  return [
    '(function () {',
    '    try {',
    ...scheme,
    "      var style = document.getElementById('phonecando-theme');",
    '      if (!style) {',
    "        style = document.createElement('style');",
    "        style.id = 'phonecando-theme';",
    '        (document.head || document.documentElement).appendChild(style);',
    '      }',
    `      style.textContent = ${css};`,
    '    } catch (e) {}',
    '  })();',
    '  true;',
  ].join('\n');
}

// Hides the web UI's own chrome that duplicates our header. It persists
// across in-app navigations and is injected again on every real page load.
function embedScript(hide: string[]): string {
  if (hide.length === 0) return 'true;';
  return [
    '',
    '  (function () {',
    "    var style = document.getElementById('phonecando-embed');",
    '    if (!style) {',
    "      style = document.createElement('style');",
    "      style.id = 'phonecando-embed';",
    `      style.textContent = '${hide.join(',')}{display:none !important}';`,
    '      document.documentElement.appendChild(style);',
    '    }',
    '  })();',
    '  true;',
    '',
  ].join('\n');
}

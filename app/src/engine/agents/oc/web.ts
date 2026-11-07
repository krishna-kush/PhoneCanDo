// opencode's web UI inside our WebView. On an opencode / web-UI bump,
// recheck the --v2-* vars below against its theme.css (the payload
// workflow's upstream check reads this file).
import type { AgentWebUi, WebPalette, WebThemeMode } from '../types';

// opencode's web UI reads this key before boot (`oc-theme-preload.js`) and
// listens for storage events after boot. Pass the app's mode so the embedded
// UI follows the shell, including `system`. Its palette is a set of v2 CSS
// variables; override only the shell-facing ones, leaving syntax/state colors
// to opencode.
function themeScript(mode: WebThemeMode, theme: WebPalette): string {
  const value = JSON.stringify(mode);
  const vars: Record<string, string> = {
    '--v2-background-bg-base': theme.bg,
    '--v2-background-bg-deep': theme.bg,
    '--v2-background-bg-layer-01': theme.panel,
    '--v2-background-bg-layer-02': theme.panel2,
    '--v2-background-bg-layer-03': theme.panel2,
    '--v2-background-bg-layer-04': theme.panel2,
    '--v2-text-text-base': theme.fg,
    '--v2-text-text-muted': theme.muted,
    '--v2-text-text-faint': theme.dim,
    '--v2-icon-icon-base': theme.muted,
    '--v2-icon-icon-muted': theme.dim,
    '--v2-icon-icon-faint': theme.faint,
    '--v2-border-border-base': theme.line,
    '--v2-border-border-strong': theme.lineStrong,
    '--v2-border-border-muted': theme.line,
    '--v2-background-bg-accent': theme.primary,
    '--v2-text-text-accent': theme.primary,
    '--v2-text-text-accent-hover': theme.primaryHi,
    '--v2-icon-icon-accent': theme.primary,
    '--v2-icon-icon-accent-hover': theme.primaryHi,
    '--v2-border-border-focus': theme.primary,
  };
  const css = JSON.stringify(
    `html:root{background-color:${theme.bg}!important;${Object.entries(vars)
      .map(([key, val]) => `${key}:${val};`)
      .join('')}}`,
  );
  return `(function () {
    try {
      localStorage.setItem('opencode-color-scheme', ${value});
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'opencode-color-scheme',
        newValue: ${value},
        storageArea: localStorage,
      }));
      var style = document.getElementById('phonecando-theme');
      if (!style) {
        style = document.createElement('style');
        style.id = 'phonecando-theme';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = ${css};
    } catch (e) {}
  })();
  true;`;
}

// The embedded web shell renders its own titlebar (tab strip chrome) above
// the content — dead space inside our app, which already has AppHeader. Hide
// it in-page (persists across SPA navigations; re-injected on every real
// page load).
const embedScript = `
  (function () {
    var style = document.getElementById('phonecando-embed');
    if (!style) {
      style = document.createElement('style');
      style.id = 'phonecando-embed';
      style.textContent = '[data-slot="titlebar-v2"]{display:none !important}';
      document.documentElement.appendChild(style);
    }
  })();
  true;
`;

export const web: AgentWebUi = {
  themeScript,
  embedScript,
  isAuthUrl: (url) => url.includes('/auth/connect/'),
  // Chat pages are /server/<dir>/session/<id> (device-checked on 2.0.26).
  sessionOf: (url) => {
    const m = /\/session\/([^/?#]+)/.exec(url);
    return m ? decodeURIComponent(m[1]) : null;
  },
};

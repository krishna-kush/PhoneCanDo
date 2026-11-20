// A kind's web UI inside our WebView, built from its manifest's web adapter
// (KindView.web.adapter): the theme script that maps the app palette onto
// the web UI's CSS variables and color-scheme key, the embed script that
// hides its own chrome, how its URLs read, and where its spots are (the
// guide's places to point at). Pure (no RN imports); vectors in
// scripts/vectors/test_web_adapter.js hold it byte-equal to what opencode's
// hand-written adapter produced.
import type {
  AgentWebUi,
  WebAdapterSpec,
  WebPalette,
  WebSpot,
  WebSpotRects,
  WebThemeMode,
} from '../../../../agents/kit/ts/contract/web.ts';

/** Every web spot, in walking order. */
const WEB_SPOTS: readonly WebSpot[] = ['projects', 'addProject', 'pickFolder', 'newChat', 'composer'];

export function webUiFor(spec: WebAdapterSpec): AgentWebUi {
  const session = spec.sessionUrl ? new RegExp(spec.sessionUrl) : null;
  const spots = spec.spots ?? {};
  return {
    themeScript: (mode, palette) => themeScript(spec, mode, palette),
    embedScript: embedScript(spec.hide ?? []),
    isAuthUrl: (url) => url.includes(spec.authUrl),
    sessionOf: (url) => {
      const m = session?.exec(url);
      return m ? decodeURIComponent(m[1]) : null;
    },
    spots: WEB_SPOTS.filter((place) => spots[place]),
    watchScript: (places) => {
      const selectors = Object.fromEntries(places.flatMap((p) => (spots[p] ? [[p, spots[p]]] : [])));
      return `window.__phonecandoSpots && window.__phonecandoSpots.watch(${JSON.stringify(selectors)});\ntrue;`;
    },
    zoomScript: (width) => zoomScript(width, spec.zoom ?? WEB_ZOOM),
  };
}

/**
 * How big our WebView shows a web UI, in percent, when its adapter names no
 * zoom: one sized for a desk reads small on a phone.
 */
export const WEB_ZOOM = 105;

/**
 * Zooms the page to `zoom` percent in a view `width` dp wide, as a browser's
 * own zoom does: its viewport tag says the page is that much narrower in CSS
 * px, so type, icons and spacing all draw bigger and full-height layouts
 * still fit. It also pins the scale there, so a pinch never zooms the page
 * (a page's own lock would otherwise be lost under the new initial-scale).
 * The tag's other keys (the keyboard's interactive-widget) stay.
 * Injected at document start, where it rewrites the page's tag once parsed,
 * and again whenever the view's width changes.
 */
function zoomScript(width: number, zoom: number): string {
  const scale = zoom / 100;
  const fit = [
    `width=${Math.round((width / scale) * 100) / 100}`,
    `initial-scale=${scale}`,
    `minimum-scale=${scale}`,
    `maximum-scale=${scale}`,
    'user-scalable=no',
  ];
  return `(function () {
  var fit = function () {
    var meta = document.querySelector('meta[name=viewport]');
    if (!meta) {
      if (!document.head) return;
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    var keep = (meta.getAttribute('content') || '').split(',').map(function (p) { return p.trim(); }).filter(function (p) {
      return p && !/^(width|initial-scale|minimum-scale|maximum-scale|user-scalable)\\s*=/.test(p);
    });
    var content = ${JSON.stringify(fit)}.concat(keep).join(', ');
    if (meta.getAttribute('content') !== content) meta.setAttribute('content', content);
  };
  fit();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fit);
})();
true;`;
}

/** How often a watching page looks for its spots again. */
const SPOT_EVERY_MS = 150;

/**
 * Injected at document start: while watching, every SPOT_EVERY_MS the page
 * finds each place's first match in front and posts where they are, when
 * that changed, as a WebSpotRects message. In front: laid out, and nothing
 * (a menu, a dialog) over its middle; one scrolled out of the viewport
 * still counts, so the guide can say which way to scroll.
 */
export const SPOTS_WATCH = `(function () {
  if (window.__phonecandoSpots) return;
  var want = {}, last = '', timer = 0;
  var find = function (selector) {
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) {
        var hit = document.elementFromPoint(cx, cy);
        if (!hit || !list[i].contains(hit)) continue;
      }
      return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
    }
    return null;
  };
  var tick = function () {
    var spots = {};
    for (var place in want) {
      var at = find(want[place]);
      if (at) spots[place] = at;
    }
    var message = JSON.stringify({ phonecandoSpots: { width: innerWidth, spots: spots } });
    if (message === last || !window.ReactNativeWebView) return;
    last = message;
    window.ReactNativeWebView.postMessage(message);
  };
  window.__phonecandoSpots = {
    watch: function (selectors) {
      want = selectors;
      last = '';
      clearInterval(timer);
      timer = 0;
      if (Object.keys(want).length > 0) {
        timer = setInterval(tick, ${SPOT_EVERY_MS});
        tick();
      }
    },
  };
})();`;

/** A page message from SPOTS_WATCH; null for any other message or a malformed one. */
export function readSpots(data: string): WebSpotRects | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  const body = (parsed as { phonecandoSpots?: unknown } | null)?.phonecandoSpots as
    | { width?: unknown; spots?: unknown }
    | undefined;
  if (!body || !isSize(body.width) || body.width <= 0 || typeof body.spots !== 'object' || body.spots == null) return null;
  const given = body.spots as Record<string, unknown>;
  const spots: WebSpotRects['spots'] = {};
  for (const place of WEB_SPOTS) {
    const at = given[place] as Record<string, unknown> | undefined;
    if (at && isSize(at.x) && isSize(at.y) && isSize(at.width) && isSize(at.height)) {
      spots[place] = { x: at.x, y: at.y, width: at.width, height: at.height };
    }
  }
  return { width: body.width, spots };
}

const isSize = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

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

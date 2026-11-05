#!/usr/bin/env node
// Browser smoke test of the built site (web/dist), one browser per run.
//
// For every viewport (desktop 1440x900, phone 390x844) × colour scheme
// (light, dark) × page (home, a missing URL that must get the 404 page):
//   - HTTP status (200 for /, 404 for the missing URL, as the host serves it)
//   - no console errors, no uncaught exceptions, no failed or 4xx/5xx
//     requests, and no request to another origin (the site ships no CDN and
//     no external JS; README "Look")
//   - title, description, canonical, lang and a single <h1>
//   - the OS colour scheme picks the theme: data-theme, <body> background and
//     <meta name="theme-color"> all equal theme/tokens.json for that scheme
//   - no horizontal scroll (document scrollWidth <= viewport width)
//   - the nav theme toggle flips light/dark and back
//   - desktop home: the install OS tabs show exactly the chosen panel
//   - the 404 page shows the requested path (its inline script)
//   - a full-page screenshot, then axe-core (WCAG 2.x A/AA tags)
//
// Playwright and @axe-core/playwright are not web deps: CI installs them in a
// throwaway folder and passes it as --tools (resolved with createRequire, so
// nothing lands in the repo).
//
//   node .github/ci/web/smoke.mjs --browser chromium --dist web/dist \
//     --out smoke-out --tools "$RUNNER_TEMP/tools" --axe report
//
// --axe: off | report (run, never fail) | critical | serious (fail at or above
// that impact). SMOKE_BROWSER_PATH overrides the browser executable (local
// runs against a browser already on the machine).

import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');

const { values: args } = parseArgs({
  options: {
    browser: { type: 'string', default: 'chromium' },
    dist: { type: 'string', default: path.join(repo, 'web/dist') },
    out: { type: 'string', default: 'smoke-out' },
    tools: { type: 'string', default: process.env.WEB_CI_TOOLS ?? process.cwd() },
    tokens: { type: 'string', default: path.join(repo, 'theme/tokens.json') },
    axe: { type: 'string', default: 'report' },
  },
});

const AXE_IMPACTS = ['minor', 'moderate', 'serious', 'critical'];
if (!['off', 'report', 'serious', 'critical'].includes(args.axe)) {
  throw new Error(`--axe must be off|report|serious|critical, got ${args.axe}`);
}
const axeFailAt = AXE_IMPACTS.indexOf(args.axe); // -1 for off/report: never fails
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const toolsRequire = createRequire(path.join(path.resolve(args.tools), 'noop.cjs'));
const playwright = toolsRequire('playwright');
const axeModule = args.axe === 'off' ? null : toolsRequire('@axe-core/playwright');
const AxeBuilder = axeModule && (axeModule.AxeBuilder ?? axeModule.default ?? axeModule);
const browserType = playwright[args.browser];
if (!browserType) throw new Error(`unknown browser ${args.browser}`);

const tokens = JSON.parse(await readFile(args.tokens, 'utf8'));
const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const SCHEMES = ['light', 'dark'];
// The 404 URL is nested on purpose: the host serves 404.html for ANY missing
// path, so its assets must load from any depth.
const MISSING = '/__ci__/no-such-sheet?from=ci';
const PAGES = [
  { name: 'home', path: '/', status: 200 },
  { name: 'not-found', path: MISSING, status: 404 },
];

await mkdir(args.out, { recursive: true });
const server = await startServer({ root: args.dist });
const base = new URL(server.url);
const browser = await browserType.launch(
  process.env.SMOKE_BROWSER_PATH ? { executablePath: process.env.SMOKE_BROWSER_PATH } : {},
);
const results = [];

try {
  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      // Firefox has no isMobile emulation: there the phone run is a narrow
      // desktop window (hover: hover), which still must not scroll sideways.
      const mobile = vp.mobile && args.browser !== 'firefox';
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        colorScheme: scheme,
        reducedMotion: 'reduce',
        ...(mobile ? { isMobile: true, hasTouch: true } : {}),
      });
      for (const pg of PAGES) {
        results.push(await checkPage(context, vp, scheme, pg));
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

async function checkPage(context, vp, scheme, pg) {
  const id = `${args.browser}-${vp.name}-${scheme}-${pg.name}`;
  const url = new URL(pg.path, base).href;
  const problems = [];
  const page = await context.newPage();
  let listening = true;
  const note = (msg) => listening && problems.push(msg);

  page.on('pageerror', (err) => note(`uncaught exception: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Browsers log the document's own 404 as an error; that one is expected.
    if (pg.status === 404 && /\b404\b/.test(text) && /failed to load resource/i.test(text)) return;
    note(`console error: ${text}`);
  });
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (u.origin !== base.origin) note(`third-party request: ${req.url()}`);
  });
  page.on('requestfailed', (req) => note(`request failed: ${req.url()} (${req.failure()?.errorText ?? '?'})`));
  page.on('response', (res) => {
    if (res.status() < 400) return;
    if (res.request().isNavigationRequest() && res.status() === pg.status) return;
    note(`HTTP ${res.status()}: ${res.url()}`);
  });

  const response = await page.goto(url, { waitUntil: 'load' });
  const status = response?.status() ?? 0;
  if (status !== pg.status) problems.push(`status ${status}, expected ${pg.status}`);
  await page.evaluate(() => document.fonts.ready.then(() => true));

  // Head, theme and layout facts in one round trip.
  const facts = await page.evaluate((width) => {
    const root = document.documentElement;
    const meta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? '';
    // Elements poking out of the viewport that no ancestor clips: the usual
    // culprits when the page scrolls sideways.
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') return true;
      }
      return false;
    };
    const offenders = [];
    if (root.scrollWidth > width) {
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if ((r.right > width + 1 || r.left < -1) && r.width > 0 && !clipped(el)) {
          offenders.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''} (${Math.round(r.left)}..${Math.round(r.right)})`);
          if (offenders.length >= 8) break;
        }
      }
    }
    return {
      title: document.title.trim(),
      lang: root.getAttribute('lang') ?? '',
      description: meta('meta[name="description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
      themeColor: meta('meta[name="theme-color"]').toLowerCase(),
      theme: root.dataset.theme ?? '',
      bg: getComputedStyle(document.body).backgroundColor,
      h1: document.querySelectorAll('h1').length,
      scrollWidth: root.scrollWidth,
      offenders,
      missPath: document.getElementById('miss-path')?.textContent ?? null,
    };
  }, vp.width);

  if (!facts.title) problems.push('empty <title>');
  if (!facts.lang) problems.push('<html> has no lang');
  if (!facts.description) problems.push('no meta description');
  if (!facts.canonical) problems.push('no canonical link');
  if (facts.h1 !== 1) problems.push(`${facts.h1} <h1> elements, expected 1`);
  const want = tokens[scheme].bg.toLowerCase();
  if (facts.theme !== scheme) problems.push(`data-theme="${facts.theme}" under prefers-color-scheme: ${scheme}`);
  if (facts.bg !== rgb(want)) problems.push(`body background ${facts.bg}, tokens.${scheme}.bg is ${rgb(want)}`);
  if (facts.themeColor !== want) problems.push(`theme-color ${facts.themeColor}, tokens.${scheme}.bg is ${want}`);
  if (facts.scrollWidth > vp.width) {
    problems.push(`horizontal scroll: scrollWidth ${facts.scrollWidth} > ${vp.width}; ${facts.offenders.join(', ') || 'no single offender found'}`);
  }
  if (pg.status === 404) {
    const shown = MISSING;
    if (facts.missPath !== shown) problems.push(`404 page shows path ${JSON.stringify(facts.missPath)}, expected ${shown}`);
  }

  const shot = path.join(args.out, `${id}.png`);
  await page.screenshot({ path: shot, fullPage: true, animations: 'disabled' });

  // axe before any interaction, on the page as it first renders.
  let axe = null;
  if (AxeBuilder) {
    const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    axe = res.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? 'minor',
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));
  }

  // Theme toggle: flips to the other scheme's tokens, then back.
  const other = scheme === 'light' ? 'dark' : 'light';
  const toggle = page.locator('.theme-toggle').first();
  await toggle.click();
  const flipped = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  if (flipped.theme !== other || flipped.bg !== rgb(tokens[other].bg)) {
    problems.push(`theme toggle gave ${flipped.theme} / ${flipped.bg}, expected ${other} / ${rgb(tokens[other].bg)}`);
  }
  await toggle.click();
  const back = await page.evaluate(() => document.documentElement.dataset.theme);
  if (back !== scheme) problems.push(`second toggle left data-theme="${back}", expected ${scheme}`);

  // Install route B: each OS tab shows its own commands and hides the rest.
  // Desktop only; phones get route A and the picker is display: none.
  if (pg.name === 'home' && !vp.mobile) {
    for (const os of ['windows', 'macos', 'linux']) {
      await page.locator(`[data-os-picker] [data-os="${os}"]`).click();
      const state = await page.evaluate((chosen) => {
        const panels = [...document.querySelectorAll('[data-os-panel]')];
        const tabs = [...document.querySelectorAll('[data-os]')];
        return {
          shown: panels.filter((p) => !p.hidden).map((p) => p.dataset.osPanel),
          pressed: tabs.filter((t) => t.getAttribute('aria-pressed') === 'true').map((t) => t.dataset.os),
          count: panels.length,
          chosen,
        };
      }, os);
      if (state.count !== 3 || state.shown.join() !== os || state.pressed.join() !== os) {
        problems.push(`OS tab ${os}: panels shown [${state.shown}], pressed [${state.pressed}] of ${state.count}`);
      }
      if (!(await page.locator(`[data-os-panel="${os}"]`).isVisible())) {
        problems.push(`OS tab ${os}: its panel is not visible`);
      }
    }
  }

  listening = false;
  await page.close();
  return { id, browser: args.browser, viewport: vp.name, scheme, page: pg.name, status, problems, axe, screenshot: path.basename(shot) };
}

// ---------- report ----------
const axeAll = results.flatMap((r) => (r.axe ?? []).map((v) => ({ ...v, where: r.id })));
const axeBlocking = axeFailAt < 0 ? [] : axeAll.filter((v) => AXE_IMPACTS.indexOf(v.impact) >= axeFailAt);
const failed = results.filter((r) => r.problems.length);
const count = (r, impact) => (r.axe ?? []).filter((v) => v.impact === impact).length;

let md = `### Smoke · ${args.browser}\n\n`;
md += `| Viewport | Scheme | Page | HTTP | Checks | axe crit / serious / other |\n|---|---|---|---|---|---|\n`;
for (const r of results) {
  const other = (r.axe ?? []).length - count(r, 'critical') - count(r, 'serious');
  md += `| ${r.viewport} | ${r.scheme} | ${r.page} | ${r.status} | ${r.problems.length ? `FAIL (${r.problems.length})` : 'pass'} | ${r.axe ? `${count(r, 'critical')} / ${count(r, 'serious')} / ${other}` : 'skipped'} |\n`;
}
if (failed.length) {
  md += `\n**Failures**\n\n`;
  for (const r of failed) for (const p of r.problems) md += `- \`${r.id}\`: ${p}\n`;
}
if (axeAll.length) {
  const byRule = new Map();
  for (const v of axeAll) {
    const e = byRule.get(v.id) ?? { ...v, runs: 0 };
    e.runs += 1;
    byRule.set(v.id, e);
  }
  md += `\n<details><summary>axe violations by rule (${byRule.size} rules, gate: ${args.axe})</summary>\n\n`;
  md += `| Rule | Impact | Runs | Nodes (one run) | Example |\n|---|---|---|---|---|\n`;
  for (const v of [...byRule.values()].sort((a, b) => AXE_IMPACTS.indexOf(b.impact) - AXE_IMPACTS.indexOf(a.impact))) {
    md += `| [${v.id}](${v.helpUrl}) | ${v.impact} | ${v.runs} | ${v.nodes} | \`${(v.targets[0] ?? '').replace(/\|/g, '\\|')}\` |\n`;
  }
  md += `\n</details>\n`;
}

console.log(md);
await writeFile(path.join(args.out, `results-${args.browser}.json`), JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n');

for (const r of failed) for (const p of r.problems) console.error(`::error title=smoke ${r.id}::${p}`);
for (const v of axeBlocking) console.error(`::error title=axe ${v.id} (${v.impact})::${v.help} at ${v.where}: ${v.targets[0] ?? ''}`);
if (failed.length || axeBlocking.length) process.exitCode = 1;

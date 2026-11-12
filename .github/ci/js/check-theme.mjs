#!/usr/bin/env node
// Theme gate: theme/tokens.json and theme/logo.json are the ONLY palette and
// the one logo/loader spec (AGENTS.md), read raw by the app, the site and
// scripts/make-logos.mjs. TypeScript covers the app's reads; the Astro build
// does not type-check, so a missing or malformed token would ship as
// `--red:undefined`. This checks the shape every consumer relies on:
//
//   tokens.json  exactly { dark, light }, the same roles in both, each value a
//                #rrggbb or rgba(r, g, b, a) colour; every role the consumers
//                name (Base.astro VAR_NAMES, tokens.<scheme>.<role> reads)
//                exists in both schemes.
//   logo.json    shadow numbers, loader timings, two cubic-bezier curves with
//                x in [0, 1], and poses that start on the 1x1 square and end
//                on pose 0 again (the loop seam both loaders depend on).
//
// Also prints a WCAG contrast table (text roles on surfaces) to the summary.
// Every text ink the site sets small (fg, muted, dim, faint) is enforced at
// AA 4.5:1 on all three surfaces; the rest is informational.
//
//   node .github/ci/js/check-theme.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, createReport, readJson, summary } from './lib.mjs';

const r = createReport();
const TOKENS = 'theme/tokens.json';
const LOGO = 'theme/logo.json';

// ---------- tokens.json ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
const RGBA = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+|1\.0+)\s*\)$/;

function parseColor(v) {
  if (typeof v !== 'string') return null;
  if (HEX.test(v)) {
    const n = parseInt(v.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const m = RGBA.exec(v);
  if (!m) return null;
  const [cr, cg, cb] = m.slice(1, 4).map(Number);
  if ([cr, cg, cb].some((c) => c > 255)) return null;
  return { r: cr, g: cg, b: cb, a: Number(m[4]) };
}

let tokens;
try {
  tokens = readJson(TOKENS);
} catch (e) {
  r.error(`not valid JSON: ${e.message}`, TOKENS);
}

const SCHEMES = ['dark', 'light'];
if (tokens) {
  const top = Object.keys(tokens).sort();
  if (top.join() !== SCHEMES.slice().sort().join()) {
    r.error(`top-level keys must be exactly ${SCHEMES.join(' + ')}, got ${top.join(', ') || '(none)'}`, TOKENS);
  }
  for (const s of SCHEMES) {
    if (!tokens[s] || typeof tokens[s] !== 'object' || Array.isArray(tokens[s])) {
      r.error(`"${s}" must be an object of role -> colour`, TOKENS);
      tokens[s] = {};
    }
    for (const [role, value] of Object.entries(tokens[s])) {
      if (!parseColor(value)) r.error(`${s}.${role} = ${JSON.stringify(value)} is not #rrggbb or rgba(r, g, b, a)`, TOKENS);
    }
  }
  // Same roles in both schemes: the site swaps every var on [data-theme],
  // the app indexes tokens[scheme] with the dark type.
  for (const [a, b] of [['dark', 'light'], ['light', 'dark']]) {
    for (const role of Object.keys(tokens[a])) {
      if (!(role in tokens[b])) r.error(`role "${role}" is in ${a} but missing from ${b}`, TOKENS);
    }
  }

  // Roles named by the consumers. Patterns are deliberately narrow; one that
  // stops matching only warns, so a refactor cannot fail this gate silently
  // passing either (the warning says which file to look at).
  const consumers = [
    {
      file: 'web/src/layouts/Base.astro',
      // const VAR_NAMES: [...][] = [ ["bg", "bg"], ["panel2", "panel-2"], ... ];
      roles(text) {
        const block = /VAR_NAMES[^=]*=\s*\[([\s\S]*?)\];/.exec(text);
        return block ? [...block[1].matchAll(/\[\s*["'](\w+)["']\s*,\s*["'][\w-]+["']\s*\]/g)].map((m) => m[1]) : [];
      },
    },
    ...[
      'web/src/layouts/Base.astro',
      'app/src/ui/common/globals/theme.ts',
      'app/plugins/withSplash.js',
      'scripts/make-logos.mjs',
    ].map((file) => ({
      file,
      // tokens.dark.primary, tokens.light.bg
      roles: (text) => [...text.matchAll(/\btokens\.(?:dark|light)\.(\w+)/g)].map((m) => m[1]),
    })),
  ];
  const used = new Map();
  for (const { file, roles } of consumers) {
    let text;
    try {
      text = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      r.warn(`consumer not found; update the list in .github/ci/js/check-theme.mjs`, file);
      continue;
    }
    const found = roles(text);
    if (!found.length) r.warn(`no token reads matched here; update the pattern in .github/ci/js/check-theme.mjs`, file);
    for (const role of found) used.set(role, [...(used.get(role) || []), file]);
  }
  for (const [role, files] of used) {
    for (const s of SCHEMES) {
      if (!(role in tokens[s])) r.error(`${s}.${role} is read by ${[...new Set(files)].join(', ')} but not defined`, TOKENS);
    }
  }

  // ---------- contrast (WCAG 2.x relative luminance) ----------
  const lum = ({ r: R, g: G, b: B }) => {
    const ch = (c) => {
      const x = c / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(R) + 0.7152 * ch(G) + 0.0722 * ch(B);
  };
  const ratio = (fg, bg) => {
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };
  // [text role, surface role, enforced minimum or 0 for informational]
  const PAIRS = [
    ...['fg', 'muted', 'dim', 'faint'].flatMap((ink) => ['bg', 'panel', 'panel2'].map((surface) => [ink, surface, 4.5])),
    ['primary', 'bg', 0],
    ['secondaryInk', 'bg', 0],
    ['onPrimary', 'primary', 0],
  ];
  const rows = [];
  for (const [fgRole, bgRole, min] of PAIRS) {
    const cells = [];
    for (const s of SCHEMES) {
      const fg = parseColor(tokens[s][fgRole]);
      const bg = parseColor(tokens[s][bgRole]);
      if (!fg || !bg || fg.a !== 1 || bg.a !== 1) {
        cells.push('n/a');
        continue;
      }
      const v = ratio(fg, bg);
      const ok = v >= min;
      if (!ok) r.error(`${s}: ${fgRole} on ${bgRole} contrast ${v.toFixed(2)}:1 is below ${min}:1`, TOKENS);
      cells.push(`${v.toFixed(2)}:1${min ? (ok ? ' ✅' : ' ❌') : ''}`);
    }
    rows.push(`| \`${fgRole}\` on \`${bgRole}\` | ${cells.join(' | ')} | ${min ? `≥ ${min}:1` : 'info'} |`);
  }
  summary(
    [
      '### Theme tokens',
      '',
      `${Object.keys(tokens.dark).length} roles per scheme; ${used.size} named by the site/app/logo consumers.`,
      '',
      '| Pair | dark | light | Gate |',
      '|---|---|---|---|',
      ...rows,
      '',
    ].join('\n'),
  );
}

// ---------- logo.json ----------
let logo;
try {
  logo = readJson(LOGO);
} catch (e) {
  r.error(`not valid JSON: ${e.message}`, LOGO);
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
function need(cond, msg) {
  if (!cond) r.error(msg, LOGO);
  return cond;
}

if (logo) {
  const { shadow = {}, loader = {} } = logo;
  need(num(shadow.ratio) && shadow.ratio > 0 && shadow.ratio < 1, 'shadow.ratio must be a number in (0, 1)');
  for (const k of ['minUiPx', 'minAssetPx']) {
    need(Number.isInteger(shadow[k]) && shadow[k] >= 0, `shadow.${k} must be a non-negative integer (pixels)`);
  }
  need(num(shadow.stretchPx) && shadow.stretchPx >= 0, 'shadow.stretchPx must be a number >= 0');

  for (const k of ['holdMs', 'endHoldMs', 'morphMs']) {
    need(num(loader[k]) && loader[k] > 0, `loader.${k} must be a positive number`);
  }
  // CSS cubic-bezier() and RN Easing.bezier() both require x1, x2 in [0, 1].
  for (const k of ['ease', 'swapEase']) {
    const e = loader[k];
    if (need(Array.isArray(e) && e.length === 4 && e.every(num), `loader.${k} must be [x1, y1, x2, y2] numbers`)) {
      need(e[0] >= 0 && e[0] <= 1 && e[2] >= 0 && e[2] <= 1, `loader.${k}: x1 and x2 must be within [0, 1]`);
    }
  }
  const poses = loader.poses;
  if (need(Array.isArray(poses) && poses.length >= 2, 'loader.poses must list at least two poses')) {
    poses.forEach((p, i) => {
      need(
        p && num(p.w) && num(p.h) && p.w >= 1 && p.h >= 1 && typeof p.swap === 'boolean',
        `loader.poses[${i}] must be { w >= 1, h >= 1, swap: boolean }`,
      );
    });
    const [first] = poses;
    const last = poses[poses.length - 1];
    // Both loaders treat pose 0 as the resting square (LogoMark's shape)...
    need(first && first.w === 1 && first.h === 1, 'loader.poses[0] must be the 1x1 square (the static mark)');
    // ...and loop by jumping from the last pose back to pose 0 in zero time.
    need(
      first && last && first.w === last.w && first.h === last.h && first.swap === last.swap,
      'the last loader pose must equal pose 0 (the zero-time loop seam in LogoLoader.tsx and logoLoaderCss.ts)',
    );
  }
  if (num(loader.holdMs) && num(loader.morphMs) && num(loader.endHoldMs) && Array.isArray(poses)) {
    const total = poses.length * loader.holdMs + (poses.length - 1) * loader.morphMs + loader.endHoldMs;
    summary(`### Logo spec\n\n${poses.length} loader poses, one loop = ${total} ms; shadow ratio ${shadow.ratio}.\n`);
  }
}

r.finish('theme');

#!/usr/bin/env node
// The built-in agent's TUI theme: opencode's own default theme (v2, kept as
// it ships in scripts/tui-theme/opencode.json, MIT like the rest of
// opencode) with its two main colours made ours, from theme/tokens.json.
// What it calls interactive (the active input, selections, links) is our
// primary red, its accent (headings, highlights) our secondary yellow;
// agents' colours start with those two (Build is the first), and what waits
// on you (warning) is the yellow too. Every other colour, the greens, blues,
// diffs, code and greys, stays opencode's. The agent's config ships it
// (agents/native/opencode/config/themes/), and the brand patch makes it the
// TUI's theme until you pick another.
//
//   node scripts/make-tui-theme.mjs   (or: pnpm tui-theme)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'agents/native/opencode/config/themes/phonecando.json';
const tokens = JSON.parse(readFileSync(join(ROOT, 'theme/tokens.json'), 'utf8'));
const theme = JSON.parse(readFileSync(join(ROOT, 'scripts/tui-theme/opencode.json'), 'utf8'));

// ---------- colour sums ----------
function rgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb token, got ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `a` moved `t` of the way to `b`. */
function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// A hue's nine steps as opencode's themes have them: 200 is the colour
// itself (what text and marks use), 100 one step stronger, 300..900 fading
// into the page.
const FADE = [0.18, 0.34, 0.48, 0.6, 0.72, 0.84, 0.93];
function scale(colour, scheme, dark) {
  const steps = { 100: mix(colour, dark ? '#ffffff' : '#000000', dark ? 0.3 : 0.2), 200: colour };
  FADE.forEach((t, i) => (steps[300 + i * 100] = mix(colour, scheme.termBg, t)));
  return steps;
}

// ---------- our two colours in each mode ----------
for (const [name, dark] of [['dark', true], ['light', false]]) {
  const scheme = tokens[name];
  const hue = theme[name].hue;
  hue.primary = scale(scheme.primary, scheme, dark);
  // Our secondary yellow in both modes, as the app wears it.
  hue.secondary = scale(scheme.secondary, scheme, dark);
  hue.interactive = '$hue.primary';
  hue.accent = '$hue.secondary';
}

// Agents' colours: ours first (Build is the first), then opencode's own.
const agents = (list) => ['primary', 'secondary', ...list.filter((h) => !['primary', 'secondary'].includes(h))];
theme.base.categorical = agents(theme.base.categorical);
for (const name of ['dark', 'light']) if (theme[name].categorical) theme[name].categorical = agents(theme[name].categorical);

// What waits on you (a command asking to run): our yellow, not opencode's orange.
theme.base.text.feedback.warning = { base: '$hue.accent.200' };
for (const name of ['dark', 'light']) {
  const warning = theme[name].text?.feedback?.warning;
  if (warning) warning.base = '$hue.accent.200';
}

mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), `${JSON.stringify(theme, null, 2)}\n`);
console.log(`tui theme: ${OUT}`);

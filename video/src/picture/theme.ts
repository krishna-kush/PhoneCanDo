// The palette, from theme/tokens.json (the only one; the site and the app
// read it too): the dark scheme, as CSS vars on the page and as plain
// colours for what draws in SVG.

import tokens from '../../../theme/tokens.json' with { type: 'json' };
import { alpha } from './color.ts';
import type { Look } from './looks.ts';

const T = tokens.dark;

/** The site's var names (web Base.astro) for each token role we use. */
const VARS: Record<string, string> = {
  '--bg': T.bg,
  '--panel': T.panel,
  '--panel2': T.panel2,
  '--line': T.line,
  '--line-strong': T.lineStrong,
  '--fg': T.fg,
  '--muted': T.muted,
  '--dim': T.dim,
  '--faint': T.faint,
  '--red': T.primary,
  '--red-hi': T.primaryHi,
  '--red-soft': T.primarySoft,
  '--on-primary': T.onPrimary,
  '--amber': T.secondary,
  '--amber-ink': T.secondary,
  '--amber-soft': T.secondarySoft,
  '--amber-line': T.secondaryLine,
  '--term-bg': T.termBg,
  '--term-fg': T.termFg,
  '--term-cursor': T.termCursor,
  '--term-panel': T.termPanel,
  '--term-line': T.termLine,
  '--term-muted': T.termMuted,
  '--term-green': T.termBrightGreen,
  '--term-blue': T.termBrightBlue,
  '--term-yellow': T.termBrightYellow,
  '--term-key': T.termKey,
  // A camera hole and a pupil are dark in every look.
  '--hole': T.termBg,
};

/** The dark scheme as CSS vars, then [look]'s roles over it; its inks for the units too. */
export function applyTheme(root: HTMLElement, look: Look) {
  // The site's blueprint grid (web base.css --grid): the amber, faint.
  const vars = { ...VARS, '--grid': alpha(T.secondary, 0.09), '--grid-dot': alpha(T.secondary, 0.3), '--grid-floor': alpha(T.secondary, 0.22), ...look.vars };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  Object.assign(INK, look.ink);
}

/** A unit's inks, as the site paints them (web/src/lib/mascot/svg.ts): wear in the text colour, eyes white on a dark pupil. */
export const INK: Record<'red' | 'amber' | 'eye' | 'dark' | 'wear', string> = {
  red: T.primary,
  amber: T.secondary,
  eye: T.onPrimary,
  dark: T.termBg,
  wear: T.fg,
};

export const COLOR = T;

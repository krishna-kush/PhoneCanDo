// Grounds to choose from (?look= on the page, --look on the renderer): the
// page's colours and what lies under every scene. Day is the video's; the
// others are there to compare. Every colour is theme/tokens.json's or a mix
// of its; in day the phone and terminal turn light with the page, in the
// rest they stay dark, as the site keeps its product art.

import tokens from '../../../theme/tokens.json' with { type: 'json' };
import { alpha, mix } from './color.ts';

const D = tokens.dark;
const L = tokens.light;

/** What lies under the scenes: the flat line grid, dots, or a grid floor running off to a horizon. */
export type Ground = 'lines' | 'dots' | 'floor';

export type Look = {
  name: string;
  /** Page roles over the dark scheme's. */
  vars: Record<string, string>;
  /** A unit's inks over the dark scheme's. */
  ink: { red?: string; amber?: string; wear?: string };
  ground: Ground;
  /** How strong the red glow is. */
  glow: number;
};

/** The site's light theme, the phone and its terminal light too. */
const DAY: Record<string, string> = {
  '--bg': L.bg,
  '--panel': L.panel,
  '--panel2': L.panel2,
  '--line': L.line,
  '--line-strong': L.lineStrong,
  '--fg': L.fg,
  '--muted': L.muted,
  '--dim': L.dim,
  '--faint': L.faint,
  '--red': L.primary,
  '--red-hi': L.primaryHi,
  '--red-soft': L.primarySoft,
  '--amber': L.secondary,
  '--amber-ink': L.secondaryInk,
  '--amber-soft': L.secondarySoft,
  '--amber-line': L.secondaryLine,
  '--grid': alpha(L.secondary, 0.16),
  '--term-bg': L.termBg,
  '--term-fg': L.termFg,
  '--term-cursor': L.termCursor,
  '--term-panel': L.termPanel,
  '--term-line': L.termLine,
  '--term-muted': L.termMuted,
  '--term-green': L.termBrightGreen,
  '--term-blue': L.termBrightBlue,
  '--term-yellow': L.termBrightYellow,
  '--term-key': L.termKey,
};

/** The dark scheme turned over: its warm cream as the paper, its black as the ink. */
const PAPER: Record<string, string> = {
  '--bg': D.fg,
  '--panel': mix(D.fg, D.bg, 0.04),
  '--panel2': mix(D.fg, D.bg, 0.08),
  '--line': alpha(D.bg, 0.12),
  '--line-strong': alpha(D.bg, 0.24),
  '--fg': D.bg,
  '--muted': L.muted,
  '--dim': L.dim,
  '--faint': L.faint,
  '--red': L.primary,
  '--red-hi': L.primaryHi,
  '--amber-ink': L.secondaryInk,
  '--grid': alpha(D.secondary, 0.2),
};

export const LOOKS = {
  night: { name: 'Night shift', vars: {}, ink: {}, ground: 'lines', glow: 1 },
  stage: { name: 'Stage floor', vars: {}, ink: {}, ground: 'floor', glow: 1.2 },
  dots: { name: 'Dot grid', vars: {}, ink: {}, ground: 'dots', glow: 1 },
  paper: { name: 'Field paper', vars: PAPER, ink: { red: L.primary, wear: D.bg }, ground: 'lines', glow: 0.55 },
  day: { name: 'Daylight', vars: DAY, ink: { red: L.primary, amber: L.secondary, wear: L.fg }, ground: 'lines', glow: 0.5 },
} as const satisfies Record<string, Look>;

export type LookId = keyof typeof LOOKS;

export const isLook = (id: string | null): id is LookId => id !== null && id in LOOKS;

/** The video's own look. */
export const LOOK: LookId = 'day';

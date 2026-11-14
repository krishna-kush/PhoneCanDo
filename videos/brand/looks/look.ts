// A look: the palette a film is drawn in, as the website names its roles
// (web Base.astro), from theme/tokens.json, the only palette. Daylight, the
// site's light theme, is ours; a film asks for another only on purpose.
// Pure.

import tokens from '../../../theme/tokens.json' with { type: 'json' };
import { alpha } from './color.ts';

const L = tokens.light;
const D = tokens.dark;

/** The roles a film colours with. Each is also a CSS var on the page: `var(--red)`. */
export type Palette = {
  bg: string;
  panel: string;
  panel2: string;
  line: string;
  line2: string;
  fg: string;
  muted: string;
  dim: string;
  faint: string;
  red: string;
  redHi: string;
  redSoft: string;
  onPrimary: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  accentLine: string;
  /** The blueprint grid's lines. */
  grid: string;
  /** A camera hole and a pupil: dark in every look. */
  hole: string;
};

export type Look = { name: string; palette: Palette };

export const DAY: Look = {
  name: 'Daylight',
  palette: {
    bg: L.bg,
    panel: L.panel,
    panel2: L.panel2,
    line: L.line,
    line2: L.lineStrong,
    fg: L.fg,
    muted: L.muted,
    dim: L.dim,
    faint: L.faint,
    red: L.primary,
    redHi: L.primaryHi,
    redSoft: L.primarySoft,
    onPrimary: L.onPrimary,
    accent: L.secondary,
    accentInk: L.secondaryInk,
    accentSoft: L.secondarySoft,
    accentLine: L.secondaryLine,
    grid: alpha(L.secondary, 0.16),
    hole: D.termBg,
  },
};

/** camelCase role → the site's var name: line2 → --line-2, redHi → --red-hi. */
const varName = (role: string) => `--${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/(\D)(\d)/, '$1-$2')}`;

/** A look's palette as CSS vars, for a style prop. */
export const varsOf = (look: Look): Record<string, string> =>
  Object.fromEntries(Object.entries(look.palette).map(([role, value]) => [varName(role), value]));

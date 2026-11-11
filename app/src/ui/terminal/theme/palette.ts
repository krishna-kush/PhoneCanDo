// The terminal's colours per scheme, from the term* roles of
// theme/tokens.json: what xterm.js draws (its theme), the colours the
// terminal tells programs (TermColors, replies.ts), the page around it
// (the row's panel and line, muted notes) and COLORFGBG. Dark keeps the
// look the terminal always had (#0a0a0a, opencode's own dark background);
// light is white, opencode's light one, with an ANSI set readable on it.
import tokens from '../../../../../theme/tokens.json';
import type { TermColors } from './replies';

export type TermScheme = 'dark' | 'light';

const ANSI = [
  ['black', 'termBlack'],
  ['red', 'termRed'],
  ['green', 'termGreen'],
  ['yellow', 'termYellow'],
  ['blue', 'termBlue'],
  ['magenta', 'termMagenta'],
  ['cyan', 'termCyan'],
  ['white', 'termWhite'],
  ['brightBlack', 'termBrightBlack'],
  ['brightRed', 'termBrightRed'],
  ['brightGreen', 'termBrightGreen'],
  ['brightYellow', 'termBrightYellow'],
  ['brightBlue', 'termBrightBlue'],
  ['brightMagenta', 'termBrightMagenta'],
  ['brightCyan', 'termBrightCyan'],
  ['brightWhite', 'termBrightWhite'],
] as const;

/** xterm.js's ITheme, as far as we set it. */
export type XtermTheme = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
} & Record<(typeof ANSI)[number][0], string>;

export type TermLook = {
  scheme: TermScheme;
  xterm: XtermTheme;
  colors: TermColors;
  /** The page around the terminal: the extra-keys row, its line, muted notes. */
  panel: string;
  line: string;
  muted: string;
  /** An extra key's box, pressed, and its label. */
  key: string;
  keyPress: string;
  keyText: string;
};

function look(scheme: TermScheme): TermLook {
  const t = tokens[scheme];
  const ansi = ANSI.map(([, role]) => t[role]);
  const xterm = {
    background: t.termBg,
    foreground: t.termFg,
    cursor: t.termCursor,
    // The letter under the block cursor, in the background's colour.
    cursorAccent: t.termBg,
    selectionBackground: t.termSelection,
    ...Object.fromEntries(ANSI.map(([name, role]) => [name, t[role]])),
  } as XtermTheme;
  return {
    scheme,
    xterm,
    colors: { dark: scheme === 'dark', foreground: t.termFg, background: t.termBg, cursor: t.termCursor, ansi },
    panel: t.termPanel,
    line: t.termLine,
    muted: t.termMuted,
    key: t.termKey,
    keyPress: t.termKeyPress,
    keyText: t.termFg,
  };
}

const LOOKS: Record<TermScheme, TermLook> = { dark: look('dark'), light: look('light') };

export function termLook(scheme: TermScheme): TermLook {
  return LOOKS[scheme];
}

/** COLORFGBG for a program that starts now: white on black, or black on white (vim, termenv, Claude Code read it). */
export function colorFgBg(scheme: TermScheme): string {
  return scheme === 'dark' ? '15;0' : '0;15';
}

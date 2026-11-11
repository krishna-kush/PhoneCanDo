// What our terminal answers a program that asks about it, for a PTY of the
// view's own (an engine's PTY is answered by the runner, kit-term
// TermReplies, with the same words). The page reports each query it parses
// and RN answers through the PTY: the colours asked for (OSC 4 / 10 / 11 /
// 12, `rgb:rrrr/gggg/bbbb` as xterm words it, ending in ST as xterm.js
// does), dark or light (CSI ? 996 n gets CSI ? 997 ; 1 n dark, ; 2 n light:
// contour's colour palette update notifications; the same report goes out
// on a change of theme while the program has DEC mode 2031 on), primary
// device attributes (as xterm.js answers them) and the operating status
// (OK). Programs send those last two after a colour query to learn that no
// more answers are coming. Pure, no RN imports.

/** The terminal's colours, each `#rrggbb` (`ansi`: black to bright white), and whether they read as dark. */
export type TermColors = {
  dark: boolean;
  foreground: string;
  background: string;
  cursor: string;
  ansi: readonly string[];
};

/**
 * A query the page parsed. `osc`: a colour command (4, 10, 11 or 12) with
 * its data after `code;` (OSC 4: index;spec pairs; 10-12: one field per
 * command from it up, so `10;?;?` asks for 10 and 11).
 */
export type TermQuery =
  | { q: 'osc'; code: number; data: string }
  | { q: 'theme' }
  | { q: 'attributes' }
  | { q: 'status' };

const ST = '\x1b\\';
const DEVICE_ATTRIBUTES = '\x1b[?1;2c';
const STATUS_OK = '\x1b[0n';
const PALETTE = 4;
const FOREGROUND = 10;
const CURSOR = 12;
const CUBE = [0, 95, 135, 175, 215, 255];

/** What the terminal writes back to [query]; empty when it names nothing we have. */
export function answer(query: TermQuery, colors: TermColors): string {
  switch (query.q) {
    case 'theme':
      return themeReport(colors.dark);
    case 'attributes':
      return DEVICE_ATTRIBUTES;
    case 'status':
      return STATUS_OK;
    case 'osc':
      return query.code === PALETTE ? paletteAnswers(query.data, colors) : dynamicAnswers(query.code, query.data, colors);
  }
}

/** The theme report: the answer to CSI ? 996 n, and what mode 2031 sends on a change. */
export function themeReport(dark: boolean): string {
  return `\x1b[?997;${dark ? 1 : 2}n`;
}

// OSC 4: index;spec pairs, `?` for a spec asks for that entry.
function paletteAnswers(data: string, colors: TermColors): string {
  const fields = data.split(';');
  let out = '';
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i + 1] !== '?' || !/^\d+$/.test(fields[i])) continue;
    const index = Number(fields[i]);
    const rgb = paletteRgb(colors, index);
    if (rgb) out += `\x1b]4;${index};${spec(rgb)}${ST}`;
  }
  return out;
}

// OSC 10, 11, 12: foreground, background, cursor; each field after the
// first is the next command's.
function dynamicAnswers(code: number, data: string, colors: TermColors): string {
  const slots = [colors.foreground, colors.background, colors.cursor];
  let out = '';
  data.split(';').forEach((field, i) => {
    const at = code + i;
    if (field !== '?' || at < FOREGROUND || at > CURSOR) return;
    const rgb = hexRgb(slots[at - FOREGROUND]);
    if (rgb) out += `\x1b]${at};${spec(rgb)}${ST}`;
  });
  return out;
}

type Rgb = [number, number, number];

/** Palette entry [index]: the 16 ANSI colours, then xterm's 6x6x6 cube and grey ramp, as xterm.js draws them. */
export function paletteRgb(colors: TermColors, index: number): Rgb | null {
  if (!Number.isInteger(index) || index < 0 || index > 255) return null;
  if (index < 16) return hexRgb(colors.ansi[index] ?? '');
  if (index < 232) {
    const i = index - 16;
    return [CUBE[Math.floor(i / 36)], CUBE[Math.floor(i / 6) % 6], CUBE[i % 6]];
  }
  const grey = 8 + (index - 232) * 10;
  return [grey, grey, grey];
}

function hexRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// xterm's spelling: each 8-bit channel repeated to 16 bits.
function spec(rgb: Rgb): string {
  return 'rgb:' + rgb.map((c) => c.toString(16).padStart(2, '0').repeat(2)).join('/');
}

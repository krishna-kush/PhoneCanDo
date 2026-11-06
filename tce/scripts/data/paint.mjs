// Terminal drawing for scripts/data.mjs: ANSI styles (off for pipes and
// NO_COLOR), number formats, bars, sparklines, cards, tables and side-by-side
// blocks. Pure and zero-dep: every function returns strings or line arrays.

const ESC = '\x1b[';
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

/** Text styles; every one is the identity when `enabled` is false. */
export function makeStyle(enabled) {
  const sgr = (open, close) => (s) => (enabled ? `${ESC}${open}m${s}${ESC}${close}m` : String(s));
  return {
    enabled,
    bold: sgr('1', '22'),
    dim: sgr('2', '22'),
    italic: sgr('3', '23'),
    inverse: sgr('7', '27'),
    accent: sgr('36', '39'),
    good: sgr('32', '39'),
    warn: sgr('33', '39'),
    bad: sgr('31', '39'),
    magenta: sgr('35', '39'),
    blue: sgr('34', '39'),
  };
}

/** Whether to colour `stream`: a TTY, NO_COLOR unset; FORCE_COLOR forces it. */
export function colorWanted(stream, env = process.env) {
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  if ('NO_COLOR' in env) return false;
  return Boolean(stream?.isTTY) && env.TERM !== 'dumb';
}

export const stripAnsi = (s) => String(s).replace(ANSI, '');
/** Visible width: code points without ANSI codes (the data has no wide glyphs we rely on). */
export const width = (s) => [...stripAnsi(s)].length;

/** Plain text cut to `w` columns with an ellipsis. */
export function fit(text, w) {
  const chars = [...String(text ?? '')];
  if (w <= 0) return '';
  return chars.length <= w ? chars.join('') : `${chars.slice(0, Math.max(0, w - 1)).join('')}…`;
}

/** Pads a (possibly styled) string to `w` visible columns. */
export function pad(s, w, align = 'left') {
  const gap = Math.max(0, w - width(s));
  return align === 'right' ? ' '.repeat(gap) + s : s + ' '.repeat(gap);
}

/** Cuts a styled line to `w` visible columns (styles are reset at the cut). */
export function clip(line, w) {
  if (width(line) <= w) return line;
  let out = '';
  let seen = 0;
  for (const part of String(line).split(/(\x1b\[[0-9;?]*[A-Za-z])/)) {
    if (part.startsWith('\x1b[')) {
      out += part;
      continue;
    }
    const chars = [...part];
    const room = w - seen;
    if (chars.length <= room) {
      out += part;
      seen += chars.length;
    } else {
      out += chars.slice(0, room).join('');
      return `${out}${ESC}0m`;
    }
  }
  return out;
}

/** 1234 → "1,234"; null/undefined → "–". */
export function num(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  return Math.round(Number(n)).toLocaleString('en-US');
}

/** "1 device", "3 devices". */
export const plural = (count, word) => `${num(count)} ${word}${Number(count) === 1 ? '' : 's'}`;

/** Short form for cards: 12,345 → "12.3k", 2,500,000 → "2.5M". */
export function compact(n) {
  if (n === null || n === undefined) return '–';
  const v = Number(n);
  if (Math.abs(v) < 10_000) return num(v);
  if (Math.abs(v) < 1_000_000) return `${(v / 1000).toFixed(v < 100_000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

/** "42%", or "–" when there is no whole. */
export function percent(part, whole) {
  if (!whole) return '–';
  const p = (100 * Number(part)) / Number(whole);
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}

/** 3,450 ms → "3.5 s". */
export function ms(v) {
  if (v === null || v === undefined) return '–';
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
}

/** Age of `t` relative to `now`: "5 min ago", "3 h ago", "2 d ago". */
export function ago(t, now) {
  if (!t) return '–';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 90) return 'just now';
  if (s < 3570) return `${Math.round(s / 60)} min ago`;
  if (s < 129_600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

/** Epoch ms → "2026-11-06 07:12" (UTC). */
export const utc = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

/** A horizontal bar of `value / max` over `w` columns, in eighths. */
export function bar(value, max, w) {
  if (!max || value <= 0 || w <= 0) return '';
  const units = Math.max(1, Math.round((Math.min(value, max) / max) * w * 8));
  return '█'.repeat(Math.floor(units / 8)) + EIGHTHS[units % 8];
}

const SPARKS = '▁▂▃▄▅▆▇█';

/** Sums `values` into at most `w` buckets (keeps the series' total). */
export function resample(values, w) {
  if (values.length <= w) return values.slice();
  const out = new Array(w).fill(0);
  values.forEach((v, i) => {
    out[Math.min(w - 1, Math.floor((i * w) / values.length))] += v;
  });
  return out;
}

/** ▁▂▃▅▇ for a series; zero days are the lowest bar. */
export function sparkline(values) {
  const max = Math.max(0, ...values);
  if (!max) return SPARKS[0].repeat(values.length);
  return values.map((v) => SPARKS[v <= 0 ? 0 : Math.min(7, Math.ceil((v / max) * 7))]).join('');
}

/**
 * Rows of label, bar, value and share: `items` are { label, value, note? }.
 * Shares are of `total` (default: the sum of the values shown).
 */
export function barList(items, { w, style, total, labelWidth, color = 'accent' }) {
  if (!items.length) return [style.dim('  nothing recorded')];
  const sum = total ?? items.reduce((a, i) => a + Number(i.value), 0);
  const max = Math.max(...items.map((i) => Number(i.value)));
  const lw = Math.min(labelWidth ?? Math.max(...items.map((i) => width(i.label))), Math.max(8, Math.floor(w * 0.4)));
  const valueText = items.map((i) => num(i.value));
  const vw = Math.max(...valueText.map((t) => t.length));
  const nw = Math.max(0, ...items.map((i) => (i.note ? 2 + width(i.note) : 0)));
  // 2 indent + label + space + bar + space + value + space + 5 share + note; bars stay readable, never wider than 40.
  const bw = Math.max(4, Math.min(40, w - lw - vw - nw - 10));
  return items.map((i, k) => {
    const share = pad(style.dim(percent(i.value, sum)), 5, 'right');
    const note = i.note ? `  ${style.dim(i.note)}` : '';
    return `  ${pad(fit(i.label, lw), lw)} ${pad(style[color](bar(Number(i.value), max, bw)), bw)} ${pad(valueText[k], vw, 'right')} ${share}${note}`;
  });
}

/** A labelled gauge: "Engine started  ████████░░  97%  1,203 of 1,240". */
export function gauge(label, part, whole, { w, style, labelWidth = 26, invert = false }) {
  const bw = Math.max(6, Math.min(30, w - labelWidth - 26));
  if (!whole) return `  ${pad(label, labelWidth)} ${style.dim('no data')}`;
  const ratio = part / whole;
  const good = invert ? ratio < 0.1 : ratio >= 0.9;
  const bad = invert ? ratio >= 0.3 : ratio < 0.6;
  const paint = good ? style.good : bad ? style.bad : style.warn;
  const filled = bar(part, whole, bw);
  return `  ${pad(label, labelWidth)} ${paint(filled)}${style.dim('░'.repeat(Math.max(0, bw - width(filled))))} ${pad(paint(percent(part, whole)), 5, 'right')}  ${style.dim(`${num(part)} of ${num(whole)}`)}`;
}

/** Aligned table: `align` holds 'right' for numeric columns. Long cells are cut to fit `w`. */
export function table(head, rows, { w, style, align = [] }) {
  if (!rows.length) return [style.dim('  nothing recorded')];
  const cells = rows.map((r) => r.map((c) => String(c ?? '')));
  const widths = head.map((h, i) => Math.max(width(h), ...cells.map((r) => width(r[i]))));
  // Shrink the widest text column until the table fits.
  const total = () => widths.reduce((a, b) => a + b, 0) + 2 * (widths.length - 1) + 2;
  while (total() > w) {
    const i = widths.reduce((best, v, k) => (align[k] !== 'right' && v > widths[best] ? k : best), align[0] === 'right' ? 1 : 0);
    if (widths[i] <= 6) break;
    widths[i]--;
  }
  const line = (r, paint = (s) => s) =>
    `  ${r
      .map((c, i) => pad(paint(width(c) > widths[i] ? fit(stripAnsi(c), widths[i]) : c), widths[i], align[i]))
      .join('  ')
      .trimEnd()}`;
  return [line(head, style.dim), `  ${style.dim(widths.map((x) => '─'.repeat(x)).join('  '))}`, ...cells.map((r) => line(r))];
}

/** Boxed cards in rows that fit `w`: { label, value, sub?, tone? }. */
export function cards(items, { w, style, cardWidth = 22 }) {
  const per = Math.max(1, Math.floor((w - 2 + 1) / (cardWidth + 1)));
  const out = [];
  for (let k = 0; k < items.length; k += per) {
    const row = items.slice(k, k + per);
    const inner = cardWidth - 2;
    const top = row.map((c) => style.dim(`┌ ${fit(c.label, inner - 3)} ${'─'.repeat(Math.max(0, inner - 2 - width(fit(c.label, inner - 3))))}┐`));
    const val = row.map((c) => `${style.dim('│')} ${pad((style[c.tone ?? 'bold'] ?? style.bold)(fit(c.value, inner - 2)), inner - 1)}${style.dim('│')}`);
    const sub = row.map((c) => `${style.dim('│')} ${pad(style.dim(fit(c.sub ?? '', inner - 2)), inner - 1)}${style.dim('│')}`);
    const bottom = row.map(() => style.dim(`└${'─'.repeat(inner)}┘`));
    for (const r of [top, val, sub, bottom]) out.push(`  ${r.join(' ')}`);
  }
  return out;
}

/** A section heading line: "── Title ─────── note" (the note is cut to fit). */
export function heading(title, { w, style, note = '' }) {
  const left = `── ${fit(title, Math.max(4, w - 8))} `;
  const right = note ? ` ${fit(note, Math.max(0, w - 4 - width(left) - 3))}` : '';
  const fill = Math.max(2, w - 2 - width(left) - width(right));
  return `  ${style.accent(style.bold(left))}${style.dim('─'.repeat(fill) + right)}`;
}

/**
 * Places blocks ({ w, lines }) side by side when they fit in `w`, else
 * stacks them with a blank line between.
 */
export function sideBySide(blocks, w, gap = 2) {
  const shown = blocks.filter((b) => b.lines.length);
  if (!shown.length) return [];
  const need = shown.reduce((a, b) => a + b.w, 0) + gap * (shown.length - 1);
  if (need > w) return shown.flatMap((b, i) => (i ? ['', ...b.lines] : b.lines));
  const height = Math.max(...shown.map((b) => b.lines.length));
  const out = [];
  for (let r = 0; r < height; r++) {
    out.push(
      shown
        .map((b, i) => (i === shown.length - 1 ? (b.lines[r] ?? '') : pad(clip(b.lines[r] ?? '', b.w), b.w)))
        .join(' '.repeat(gap))
        .trimEnd(),
    );
  }
  return out;
}

/** A dim, indented paragraph wrapped to `w`. */
export function note(text, { w, style, tone = 'dim' }) {
  return wrap(text, Math.max(10, w - 4)).map((l) => `  ${style[tone](l)}`);
}

/** Word-wraps plain text to `w` columns, keeping its own line breaks. */
export function wrap(text, w) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      if (!line) line = word;
      else if (width(line) + 1 + width(word) <= w) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
      while (width(line) > w) {
        out.push([...line].slice(0, w).join(''));
        line = [...line].slice(w).join('');
      }
    }
    out.push(line);
  }
  return out;
}

const ANDROID = { 36: '16', 35: '15', 34: '14', 33: '13', 32: '12L', 31: '12', 30: '11', 29: '10', 28: '9', 27: '8.1', 26: '8.0' };

/** SDK level → "Android 16 (36)". */
export const androidName = (sdk) => (ANDROID[sdk] ? `Android ${ANDROID[sdk]} (${sdk})` : `SDK ${sdk}`);

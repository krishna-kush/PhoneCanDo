// Blocks the data script's tab screens share (views.mjs, links/views.mjs):
// trend rows of daily series and titled bar lists. Pure: values in, lines out.

import { barList, fit, heading, num, pad, resample, sparkline, width } from './paint.mjs';

/** Sum of a series. */
export const total = (values) => values.reduce((a, b) => a + b, 0);
/** "last 30 days · 2026-10-08 to 2026-11-06 UTC". */
export const windowNote = (m) => `last ${m.meta.days} days · ${m.meta.sinceDay} to ${m.meta.today} UTC`;

/** The stats text after a trend row; `distinct` replaces the total where days overlap (devices). */
function trendStats(values, running, distinct) {
  const tail = `peak ${num(Math.max(0, ...values))} · today ${num(values[values.length - 1] ?? 0)}`;
  if (distinct !== undefined) return `${num(distinct)} distinct · ${tail}`;
  if (!running) return `total ${num(total(values))} · ${tail}`;
  const known = values.filter((v) => v !== null);
  if (!known.length) return 'no data yet';
  const first = known[0];
  const last = known[known.length - 1];
  return `now ${num(last)} · ${last >= first ? '+' : ''}${num(last - first)} in the window`;
}

/** Sparkline rows for daily series, with the date span under them. */
export function trends(rows, m, { w, style }) {
  const lw = 18;
  const statsWidth = Math.max(...rows.map((r) => width(trendStats(r.values, r.running, r.distinct))));
  const sw = Math.max(7, Math.min(m.meta.days, w - 2 - lw - 2 - statsWidth));
  const out = rows.map(({ label, values, tone = 'accent', running = false, distinct }) => {
    const stats = style.dim(trendStats(values, running, distinct));
    if (running) {
      // A running total (stars): resampling would add days up, so take each bucket's last value.
      const known = values.filter((v) => v !== null);
      const step = values.length / sw;
      const shown = values.length <= sw ? values : Array.from({ length: sw }, (_, i) => values[Math.min(values.length - 1, Math.floor((i + 1) * step) - 1)]);
      const lo = Math.min(...(known.length ? known : [0]));
      const line = sparkline(shown.map((v) => (v === null ? 0 : v - lo + 1)));
      return `  ${pad(label, lw)}${style[tone](line)}  ${stats}`;
    }
    return `  ${pad(label, lw)}${style[tone](sparkline(resample(values, sw)))}  ${stats}`;
  });
  const span = `${m.meta.sinceDay}${' '.repeat(Math.max(1, sw - 20))}${m.meta.today}`;
  out.push(`  ${' '.repeat(lw)}${style.dim(fit(span, Math.max(sw, 21)))}`);
  return out;
}

/** A titled block for sideBySide. */
export function block(title, items, { w, style, note, ...rest }) {
  return { w, lines: [heading(title, { w, style, note }), ...barList(items, { w, style, ...rest })] };
}

/** The width of each of two blocks side by side. */
export function half(w) {
  return Math.floor((w - 2) / 2);
}

// Detail screens of the interactive scripts/data.mjs (never in the build
// report): one error with its stack frames, one report with its note, phone
// and log tail, and the key help. Pure: item in, lines out.

import { ago, fit, heading, num, pad, plural, utc, wrap } from './paint.mjs';

const field = (style, label, value) => `  ${style.dim(label.padEnd(12))} ${value}`;

/** `line` in pieces of `w` characters, spacing kept (logs). */
function chunks(line, w) {
  const chars = [...line.replace(/\t/g, '  ')];
  if (!chars.length) return [''];
  const out = [];
  for (let i = 0; i < chars.length; i += w) out.push(chars.slice(i, i + w).join(''));
  return out;
}

/** Lines inside a light box, hard-wrapped to `w`; only the last `maxLines` are kept. */
function boxed(text, { w, style, maxLines = 60 }) {
  const inner = Math.max(10, w - 6);
  let body = String(text ?? '')
    .split('\n')
    .flatMap((l) => chunks(l, inner));
  if (body.length > maxLines) body = [style.dim(`… ${body.length - maxLines} earlier lines`), ...body.slice(-maxLines)];
  return [
    `  ${style.dim(`┌${'─'.repeat(inner + 2)}┐`)}`,
    ...body.map((l) => `  ${style.dim('│')} ${pad(l, inner)} ${style.dim('│')}`),
    `  ${style.dim(`└${'─'.repeat(inner + 2)}┘`)}`,
  ];
}

export function errorDetail(e, { w, style, now }) {
  const lines = [
    heading(`${e.kind} · ${e.className}`, { w, style }),
    field(style, 'Version', `v${e.version}`),
    field(style, 'Seen', `${plural(e.count, 'time')} on ${plural(e.devices, 'device')}`),
    field(style, 'First', `${utc(e.first)} UTC (${ago(e.first, now)})`),
    field(style, 'Last', `${utc(e.last)} UTC (${ago(e.last, now)})`),
    field(style, 'Key', style.dim(fit(e.key, w - 17))),
    '',
    heading('Message', { w, style }),
    ...wrap(e.message || '(empty)', w - 4).map((l) => `  ${l}`),
    '',
    heading('Stack frames', { w, style, note: 'top 5, paths redacted on the phone and the server' }),
  ];
  if (!e.frames.length) lines.push(style.dim('  none recorded'));
  e.frames.forEach((f, i) => lines.push(`  ${style.dim(`${i + 1}.`)} ${fit(f, w - 6)}`));
  return lines;
}

export function reportDetail(r, { w, style, now }) {
  const d = r.device;
  const lines = [
    heading(`Report ${String(r.id).slice(0, 8)}`, { w, style, note: `${utc(r.received)} UTC · ${ago(r.received, now)}` }),
    field(style, 'App', `v${r.version} ${r.channel}`),
    field(style, 'Phone', fit([d.name, d.android, d.ramGb ? `${d.ramGb} GB` : null, d.locale].filter(Boolean).join(' · '), w - 17)),
    field(style, 'Installed by', d.installer ?? '–'),
    field(style, 'Events', `${num(r.events)} recent events attached`),
    '',
    heading('Note', { w, style }),
    ...(r.note ? wrap(r.note, w - 4).map((l) => `  ${style.italic(l)}`) : [style.dim('  (no note)')]),
    '',
    heading('Engine log tail', { w, style, note: 'last 2,000 characters, redacted' }),
  ];
  if (r.logTail) lines.push(...boxed(r.logTail, { w, style }));
  else lines.push(style.dim('  none attached'));
  return lines;
}

export function helpLines({ w, style }) {
  const key = (k, what) => `  ${style.accent(k.padEnd(18))} ${fit(what, Math.max(10, w - 22))}`;
  return [
    heading('Keys', { w, style }),
    key('← → · h l · tab', 'previous / next tab'),
    key('1 … 9', 'jump to a tab'),
    key('↑ ↓ · j k', 'scroll, or move the selection in Errors and Reports'),
    key('pgup pgdn · space', 'page'),
    key('g · G', 'top / bottom'),
    key('enter', 'open the selected error or report'),
    key('esc · backspace', 'back'),
    key('w', 'window: 7 → 30 → 90 days'),
    key('t', 'show or hide our tester devices'),
    key('r', 'reload (one D1 batch; rows read count toward 5M a day)'),
    key('q · ctrl-c', 'quit'),
    '',
    `  ${style.dim(fit('Read-only: only SELECTs run. Device ids are never shown.', w - 4))}`,
  ];
}

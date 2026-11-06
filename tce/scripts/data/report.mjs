// The non-interactive output of scripts/data.mjs: every tab in turn, aggregates
// only (no report notes, logs or stack frames), for build logs, pipes and
// --report. Pure: model in, text out.

import { num } from './paint.mjs';
import { TABS, renderTab } from './views.mjs';

/** One line naming what was read: database, source, window, testers and the D1 cost. */
export function describe(m) {
  return [
    `D1 ${m.meta.database}`,
    `via ${m.meta.source}`,
    `last ${m.meta.days} days (${m.meta.sinceDay} to ${m.meta.today} UTC)`,
    m.meta.testers ? 'testers included' : 'testers left out',
    `${num(m.meta.rowsRead)} rows read`,
  ].join(' · ');
}

export function renderReport(model, { w, style }) {
  const out = [style.bold('TCE usage data'), style.dim(describe(model))];
  for (const tab of TABS) {
    out.push('', `${style.accent('▌')} ${style.bold(tab.title.toUpperCase())}`, '', ...renderTab(tab.id, model, { w, style, report: true }).lines);
  }
  return out.join('\n');
}

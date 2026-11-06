// The screens of scripts/data.mjs, one renderer per tab. Each returns
// { lines, items } where items[i] is the line index of list entry i (errors,
// reports) so the interactive view can highlight and scroll to a selection.
// The build report prints every tab in turn with { report: true }: no report
// notes, logs or stack frames, only aggregates. Pure: model in, lines out.

import { ago, barList, cards, compact, fit, gauge, heading, ms, note, num, pad, plural, resample, sideBySide, sparkline, table, utc, width } from './paint.mjs';

export const TABS = [
  { id: 'overview', title: 'Overview' },
  { id: 'devices', title: 'Devices' },
  { id: 'installs', title: 'Installs' },
  { id: 'health', title: 'Health' },
  { id: 'events', title: 'Events' },
  { id: 'errors', title: 'Errors', list: true },
  { id: 'reports', title: 'Reports', list: true },
  { id: 'site', title: 'Site' },
  { id: 'github', title: 'GitHub' },
];

const total = (values) => values.reduce((a, b) => a + b, 0);
const windowNote = (m) => `last ${m.meta.days} days · ${m.meta.sinceDay} to ${m.meta.today} UTC`;

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
function trends(rows, m, { w, style }) {
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
function block(title, items, { w, style, note, ...rest }) {
  return { w, lines: [heading(title, { w, style, note }), ...barList(items, { w, style, ...rest })] };
}

function half(w) {
  return Math.floor((w - 2) / 2);
}

// ---------- tabs ----------

function overview(m, ctx) {
  const { style, w } = ctx;
  const t = m.totals;
  const site = m.site;
  const lines = cards(
    [
      { label: 'Devices', value: num(t.devices), sub: `${num(t.devicesActive)} active · +${num(t.devicesNew)} new` },
      { label: 'Installs', value: num(t.installs), sub: `+${num(t.installsNew)} new` },
      { label: 'Sessions', value: compact(t.sessions), sub: plural(t.sessionDevices, 'device') },
      { label: 'Events', value: compact(t.events), sub: `${num(m.events.names.length)} kinds` },
      { label: 'Errors', value: compact(t.errors), sub: plural(t.errorDevices, 'device'), tone: t.errors ? 'bad' : 'good' },
      { label: 'Reports', value: num(t.reports), sub: `+${num(t.reportsNew)} in window` },
      { label: 'Page views', value: compact(total(site.views)), sub: `${compact(site.totals.views)} all time` },
      { label: 'Downloads', value: compact(total(site.downloads)), sub: `${compact(total(Object.values(site.totals.downloads)))} all time` },
      { label: 'GitHub stars', value: m.github.latest ? num(m.github.latest.stars) : '–', sub: m.github.latest ? `${num(m.github.latest.forks)} forks` : 'no data yet' },
    ],
    ctx,
  );
  lines.push('', heading('Daily', { w, style, note: windowNote(m) }));
  lines.push(
    ...trends(
      [
        { label: 'Active devices', values: m.daily.devices, distinct: m.totals.sessionDevices },
        { label: 'Sessions', values: m.daily.sessions },
        { label: 'Events', values: m.daily.events },
        { label: 'Errors', values: m.daily.errors, tone: 'bad' },
        { label: 'Page views', values: site.views, tone: 'magenta' },
        { label: 'Downloads', values: site.downloads, tone: 'magenta' },
        { label: 'GitHub downloads', values: m.github.downloadsPerDay, tone: 'blue' },
      ],
      m,
      ctx,
    ),
  );
  const bw = half(w);
  lines.push('', ...sideBySide([block('Channels', m.installs.channels, { ...ctx, w: bw }), block('Versions in use', m.installs.versions.slice(0, 5), { ...ctx, w: bw })], w));
  if (!m.meta.testers && t.testers) lines.push('', ...note(`${num(t.testers)} tester device${t.testers === 1 ? '' : 's'} left out of every count (t shows them)`, ctx));
  return { lines };
}

function devices(m, ctx) {
  const d = m.devices;
  const bw = half(ctx.w);
  const pair = (a, b) => sideBySide([block(a[0], a[1], { ...ctx, w: bw }), block(b[0], b[1], { ...ctx, w: bw })], ctx.w);
  return {
    lines: [
      ...note(`Devices seen in the ${windowNote(m)}: ${num(m.totals.devicesActive)}`, ctx),
      '',
      ...pair(['Phones', d.models], ['Android', d.android]),
      '',
      ...pair(['Memory', d.ram], ['ABI', d.abis]),
      '',
      ...pair(['Countries', d.countries], ['Locales', d.locales]),
    ],
  };
}

function installs(m, ctx) {
  const i = m.installs;
  return {
    lines: [
      heading('Channels', { ...ctx, note: `${num(m.totals.installs)} installs, all time` }),
      ...barList(i.channels, ctx),
      '',
      heading('How the app was installed', ctx),
      ...barList(i.sources, ctx),
      '',
      heading('Versions in use', { ...ctx, note: `installs seen in the ${windowNote(m)}` }),
      ...barList(i.versions, ctx),
    ],
  };
}

/** The boot histogram in readable ranges: whole seconds to 10 s, then 10–20 s and 20 s+. */
export function bootRanges(hist) {
  const ranges = [];
  const add = (label, from, to) => ranges.push({ label, value: hist.filter((h) => h.bucket >= from && h.bucket < to).reduce((a, h) => a + h.n, 0) });
  for (let s = 0; s < 10; s++) add(`${s}–${s + 1} s`, s * 1000, (s + 1) * 1000);
  add('10–20 s', 10_000, 20_000);
  add('20 s or more', 20_000, Infinity);
  return ranges.filter((r, k) => r.value || ranges.slice(k + 1).some((x) => x.value));
}

function health(m, ctx) {
  const h = m.health;
  const sessions = m.totals.sessions;
  return {
    lines: [
      heading('Engine and phone', { ...ctx, note: `${num(sessions)} sessions, ${windowNote(m)}` }),
      gauge('Engine started', h.engine.ok, h.engine.known, ctx),
      gauge('Accessibility on', h.a11y.ok, h.a11y.known, ctx),
      gauge('Battery optimisation off', h.battery.ok, h.battery.known, ctx),
      gauge('Foreground service ran', h.fgService.ok, h.fgService.known, ctx),
      gauge('Low-memory trims', h.trimmed.ok, h.trimmed.known, { ...ctx, invert: true }),
      ...note(`${num(h.trims)} low-memory callbacks in total`, ctx),
      '',
      heading('Boot time', { ...ctx, note: `p50 ${ms(h.boot.p50)} · p90 ${ms(h.boot.p90)} · ${num(h.boot.count)} sessions` }),
      ...barList(bootRanges(h.boot.hist), ctx),
      '',
      heading('Engine exit codes', ctx),
      ...barList(h.exitCodes, { ...ctx, color: 'warn' }),
    ],
  };
}

function events(m, ctx, { report }) {
  const names = report ? m.events.names.slice(0, 15) : m.events.names;
  return {
    lines: [
      heading('Events', { ...ctx, note: `${num(m.totals.events)} events · ${num(m.events.names.length)} kinds · ${windowNote(m)}` }),
      ...barList(
        names.map((e) => ({ label: e.label, value: e.value, note: plural(e.devices, 'device') })),
        { ...ctx, total: m.totals.events },
      ),
      ...(report && m.events.names.length > names.length ? note(`… ${m.events.names.length - names.length} more kinds`, ctx) : []),
    ],
  };
}

const KIND_TONE = { js: 'warn', native: 'bad', engine: 'magenta' };

function errors(m, ctx, { report, selected }) {
  const { style, w } = ctx;
  const kinds = m.errors.kinds.map((k) => `${k.label} ${num(k.value)}`).join(' · ');
  const lines = [heading('Errors', { ...ctx, note: `${plural(m.totals.errors, 'error')} on ${plural(m.totals.errorDevices, 'device')} · ${windowNote(m)}` })];
  if (kinds) lines.push(...note(`by kind: ${kinds}`, ctx), '');
  const keys = report ? m.errors.keys.slice(0, 10) : m.errors.keys;
  if (!keys.length) return { lines: [...lines, style.dim('  No errors in this window.')], items: [] };
  const items = [];
  keys.forEach((e, i) => {
    items.push(lines.length);
    const mark = i === selected ? style.accent('▶') : ' ';
    const kind = (style[KIND_TONE[e.kind]] ?? style.dim)(pad(e.kind, 6));
    const right = style.dim(`${num(e.count)}× · ${plural(e.devices, 'device')} · ${ago(e.last, m.meta.now)}`);
    const left = `${e.className} · v${e.version}`;
    const room = w - 14 - width(right);
    const title = i === selected ? style.inverse(` ${fit(left, room)} `) : ` ${style.bold(fit(left, room))} `;
    lines.push(`  ${mark} ${kind}${pad(title, room + 2)} ${right}`);
    lines.push(`           ${style.dim(fit(e.message.replace(/\s+/g, ' '), w - 13))}`);
  });
  if (!report) lines.push('', ...note('↑↓ select · enter for the stack frames', ctx));
  return { lines, items };
}

function reports(m, ctx, { report, selected }) {
  const { style, w } = ctx;
  const lines = [heading('Reports', { ...ctx, note: `${num(m.totals.reports)} total · ${num(m.totals.reportsNew)} in the window · newest first` })];
  if (!m.reports.length) return { lines: [...lines, style.dim('  No reports yet.')], items: [] };
  const items = [];
  const shown = report ? m.reports.slice(0, 10) : m.reports;
  shown.forEach((r, i) => {
    items.push(lines.length);
    const mark = i === selected ? style.accent('▶') : ' ';
    const text = `${utc(r.received)} · v${r.version} ${r.channel} · ${num(r.events)} events${report ? '' : ` · ${r.device.name}`}`;
    lines.push(`  ${mark} ${i === selected ? style.inverse(` ${fit(text, w - 8)} `) : ` ${fit(text, w - 8)} `}`);
    if (!report) lines.push(`      ${r.note ? style.italic(fit(`“${r.note.replace(/\s+/g, ' ')}”`, w - 8)) : style.dim('(no note)')}`);
  });
  lines.push('', ...note(report ? 'Notes and logs stay out of build logs: run ./manage data to read them.' : '↑↓ select · enter for the note, phone and log', ctx));
  return { lines, items };
}

function site(m, ctx) {
  const { style, w } = ctx;
  const s = m.site;
  const bw = half(w);
  const downloads = Object.entries(s.totals.downloads).map(([k, v]) => `${k} ${num(v)}`).join(' · ');
  const lines = [
    heading('Site', { ...ctx, note: `site_daily · ${windowNote(m)}` }),
    ...trends(
      [
        { label: 'Page views', values: s.views, tone: 'magenta' },
        { label: 'Downloads', values: s.downloads, tone: 'magenta' },
      ],
      m,
      ctx,
    ),
    '',
    ...sideBySide(
      [
        block('Top pages', s.paths, { ...ctx, w: bw }),
        block('Downloads by channel', s.channels, { ...ctx, w: bw }),
      ],
      w,
    ),
    '',
    heading('Countries', { ...ctx, note: 'page views · downloads' }),
    ...table(
      ['Country', 'Views', 'Downloads'],
      s.countries.map((c) => [c.label, num(c.views), num(c.downloads)]),
      { ...ctx, align: ['left', 'right', 'right'] },
    ),
    '',
    ...note(`All time: ${num(s.totals.views)} page views${downloads ? ` · downloads ${downloads}` : ''}${s.totals.firstDay ? ` · since ${s.totals.firstDay}` : ''}`, ctx),
    ...note('site_daily counts every client, bots included; HEAD requests and rate-limited ones are not counted.', ctx),
  ];
  const ae = m.ae;
  lines.push('', heading('Analytics Engine detail', { ...ctx, note: 'sample-weighted · kept about 3 months' }));
  if (!ae.available) {
    lines.push(...note(ae.note ?? 'no data', ctx));
    return { lines };
  }
  if (ae.note) lines.push(...note(ae.note, { ...ctx, tone: 'warn' }));
  lines.push(
    ...sideBySide([block('Page views by client', ae.viewClients, { ...ctx, w: bw }), block('Referrers (no bots)', ae.viewReferrers, { ...ctx, w: bw })], w),
    '',
    ...sideBySide(
      [
        block('Downloads by people', ae.downloadPeople, { ...ctx, w: bw, note: `${num(ae.downloadBots)} by bots` }),
        block('Downloads by client', ae.downloadClients, { ...ctx, w: bw }),
      ],
      w,
    ),
    '',
    ...sideBySide([block('Android of downloaders', ae.downloadAndroid, { ...ctx, w: bw }), block('Download referrers', ae.downloadReferrers, { ...ctx, w: bw })], w),
  );
  return { lines };
}

function github(m, ctx) {
  const { style } = ctx;
  const g = m.github;
  const l = g.latest;
  const lines = [heading('GitHub', { ...ctx, note: l ? `counters of ${l.day} (cron, daily 03:17 UTC)` : 'the daily cron has not run yet' })];
  if (l) {
    lines.push(`  ${style.bold(num(l.stars))} stars · ${style.bold(num(l.forks))} forks · ${style.bold(num(l.watchers))} watchers${l.views === null || l.views === undefined ? '' : ` · ${num(l.views)} views (${num(l.uniques)} unique, 14 days)`}`, '');
  }
  lines.push(
    ...trends(
      [
        { label: 'Stars', values: g.stars, tone: 'warn', running: true },
        { label: 'Downloads / day', values: g.downloadsPerDay, tone: 'blue' },
        { label: 'Update checks', values: g.checksPerDay, tone: 'blue' },
      ],
      m,
      ctx,
    ),
    ...note('Update checks are latest.json fetches: about one per app launch. GitHub counts bots and retries too.', ctx),
    '',
    heading('Release assets', { ...ctx, note: g.assetsDay ? `download counts on ${g.assetsDay}` : '' }),
    ...table(
      ['Tag', 'Asset', 'Downloads'],
      g.assets.map((a) => [a.tag, a.asset, num(a.downloads)]),
      { ...ctx, align: ['left', 'left', 'right'] },
    ),
  );
  return { lines };
}

const RENDER = { overview, devices, installs, health, events, errors, reports, site, github };

/** Renders tab `id`: { lines, items? }. `selected` is the list selection (errors, reports). */
export function renderTab(id, model, { w, style, selected = -1, report = false }) {
  const out = RENDER[id](model, { w, style }, { report, selected });
  return { lines: out.lines, items: out.items ?? [] };
}

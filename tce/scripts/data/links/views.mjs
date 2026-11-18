// The Share links and Campaigns tabs of scripts/data.mjs. Pure: model in,
// lines out. The build report ({ report: true }) leaves the share codes out,
// as it leaves out the phones that sent reports: aggregates only.

import { trends, windowNote } from '../blocks.mjs';
import { cards, compact, fit, heading, note, num, pad, percent, plural, table, width } from '../paint.mjs';
import { NEW_TABLE_MIGRATION } from './queries.mjs';

const NOT_SET_UP = 'not set up yet';

/** "<table> is not on the database (migration 000N)". */
const notOnDatabase = (table) => `${table} is not on the database (migration ${NEW_TABLE_MIGRATION[table]})`;

/** Label and value rows with a dim note after each: [label, value, note?]. */
function facts(rows, { w, style }) {
  const lw = Math.min(Math.max(...rows.map(([label]) => width(label))), Math.max(10, w - 24));
  const vw = Math.max(...rows.map(([, value]) => width(value)));
  return rows.map(([label, value, tail = '']) => {
    const line = `  ${pad(fit(label, lw), lw)}  ${pad(value, vw, 'right')}`;
    return tail ? `${line}  ${style.dim(fit(tail, Math.max(0, w - width(line) - 2)))}` : line;
  });
}

function topTable(s, ctx, report) {
  const lines = [heading('Top links by installs', { ...ctx, note: 'all time' })];
  if (!s.top.length) return [...lines, ctx.style.dim('  No installs through a link yet.')];
  lines.push(
    ...table(
      ['Link', 'Installs', 'Using', 'Opens', 'Downloads'],
      s.top.map((t, k) => [report ? `#${k + 1}` : t.code, num(t.installs), num(t.using), num(t.opens), num(t.downloads)]),
      { ...ctx, align: ['left', 'right', 'right', 'right', 'right'] },
    ),
  );
  if (report) lines.push(...note('Codes stay out of build logs: run ./manage data to see them.', ctx));
  return lines;
}

function secondTable(s, ctx) {
  const x = s.second;
  return [
    heading('Who brings in whom', { ...ctx, note: 'all time' }),
    ...facts(
      [
        ['Phones that came through a link', num(x.came), 'installs with usage stats on'],
        ['… that sent links themselves', num(x.sharers), x.came ? `${percent(x.sharers, x.came)} · the second generation` : 'the second generation'],
        ['Installs through their links', num(x.installs)],
        ['Installs per phone that came', x.perCame === null ? '–' : x.perCame.toFixed(2), 'their installs ÷ phones that came'],
      ],
      ctx,
    ),
  ];
}

/** The Share links tab. */
export function share(m, ctx, { report = false } = {}) {
  const s = m.share;
  const i = s.installs;
  const lines = cards(
    [
      { label: 'Links sent', value: num(s.links.sent), sub: `+${num(s.links.sentNew)} new · ${plural(s.links.sharers, 'phone')}` },
      { label: 'Opens', value: compact(s.opens.all), sub: `${compact(s.opens.window)} in window` },
      { label: 'Downloads', value: compact(s.downloads.all), sub: `${compact(s.downloads.window)} in window` },
      { label: 'Installs', value: num(i.all), sub: `${num(i.window)} in window` },
      { label: 'Still using', value: num(i.using), sub: `${percent(i.using, i.all)} of installs` },
      { label: 'Conversion', value: percent(i.all, s.downloads.all), sub: `${percent(i.window, s.downloads.window)} in window` },
    ],
    ctx,
  );
  lines.push(
    '',
    heading('Daily', { ...ctx, note: windowNote(m) }),
    ...trends(
      [
        { label: 'Opens', values: s.opens.daily, tone: 'magenta' },
        { label: 'Downloads', values: s.downloads.daily, tone: 'magenta' },
        { label: 'Installs', values: i.daily },
      ],
      m,
      ctx,
    ),
    '',
    ...topTable(s, ctx, report),
    '',
    ...secondTable(s, ctx),
    '',
    ...note(
      'Installs: phones with usage stats on that opened PhoneCanDo through a link (share.install). Conversion: installs ÷ downloads. Still using: installs whose phone had a session on a later UTC day, as the app\'s Tell a friend page counts.',
      ctx,
    ),
  );
  if (!m.meta.testers) lines.push(...note('Links our tester devices own and their installs are left out (t shows them).', ctx));
  return { lines };
}

/** The Campaigns tab. */
export function campaigns(m, ctx) {
  const c = m.campaigns;
  const lines = [heading('Campaigns', { ...ctx, note: 'all time · the list: D1 table campaigns' })];
  if (!c.listReady) lines.push(...note(`The list is ${NOT_SET_UP}: ${notOnDatabase('campaigns')}.`, { ...ctx, tone: 'warn' }));
  if (!c.ready) lines.push(...note(`Counts ${NOT_SET_UP}: ${notOnDatabase('campaign_daily')}.`, { ...ctx, tone: 'warn' }));
  if (!c.tags.length) lines.push(ctx.style.dim('  No campaigns yet: ./manage campaign add <tag> "<note>"'));
  else {
    const count = (v) => (c.ready ? num(v) : '–');
    lines.push(
      ...table(
        ['Tag', 'Note', 'Added', 'Opens', 'Downloads', 'Rate', 'Last day'],
        c.tags.map((t) => [
          t.tag,
          t.listed ? t.note : c.listReady ? '(no longer listed)' : '–',
          t.added ?? '–',
          count(t.opens),
          count(t.downloads),
          c.ready ? percent(t.downloads, t.opens) : '–',
          t.lastDay ?? '–',
        ]),
        { ...ctx, align: ['left', 'left', 'left', 'right', 'right', 'right', 'left'] },
      ),
    );
  }
  if (c.ready) {
    lines.push(
      '',
      heading('Daily, all campaigns', { ...ctx, note: windowNote(m) }),
      ...trends(
        [
          { label: 'Opens', values: c.opens.daily, tone: 'magenta' },
          { label: 'Downloads', values: c.downloads.daily, tone: 'magenta' },
        ],
        m,
        ctx,
      ),
    );
  }
  lines.push(
    '',
    ...note(
      'Opens: the site\'s page view beacon on /?c=<tag>; downloads: /v1/dl/<channel>?c=<tag>. People only, never bots; only tags in the campaigns table count. Rate: downloads ÷ opens. ./manage campaign add <tag> "<note>" adds one to the table; it counts from then on, no push needed.',
      ctx,
    ),
  );
  return { lines };
}

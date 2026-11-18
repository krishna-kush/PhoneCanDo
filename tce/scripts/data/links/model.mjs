// The Share links and Campaigns parts of the data script's model. Pure: rows
// in, plain objects out. Rows from links/queries.mjs carry day '' for every
// day before the window, so one set of rows gives all-time totals and the
// window's daily series. Device ids never enter it.

import { campaignListOf } from './campaign-list.mjs';

const n = (v) => Number(v ?? 0) || 0;

/** { all, window, daily } of `rows`' `key`: all time, inside the window, and per window day. */
export function spread(days, rows, key = 'n') {
  let all = 0;
  let window = 0;
  const by = new Map();
  for (const r of rows) {
    const v = n(r[key]);
    all += v;
    if (!r.day) continue;
    window += v;
    by.set(r.day, (by.get(r.day) ?? 0) + v);
  }
  return { all, window, daily: days.map((d) => by.get(d) ?? 0) };
}

/** The later of two YYYY-MM-DD days (null counts as none). */
const later = (a, b) => (b && (!a || b > a) ? b : a);

/** The Share links tab's numbers: share_links, share_daily and the identified installs (share_installs). */
export function shareModel(r, days) {
  const links = r.shareLinks?.[0] ?? {};
  const daily = r.shareDaily ?? [];
  const rows = r.shareInstalls ?? [];
  const second = r.shareSecond?.[0] ?? {};
  const came = n(second.came);
  const brought = n(second.installs);
  return {
    links: { sent: n(links.links), sentNew: n(links.links_new), sharers: n(links.sharers) },
    opens: spread(days, daily.filter((x) => x.step === 'open')),
    downloads: spread(days, daily.filter((x) => x.step === 'download')),
    installs: { ...spread(days, rows), using: rows.reduce((a, x) => a + n(x.still_using), 0) },
    top: (r.shareTop ?? []).map((x) => ({
      code: String(x.code),
      installs: n(x.installs),
      using: n(x.still_using),
      opens: n(x.opens),
      downloads: n(x.downloads),
    })),
    second: { came, sharers: n(second.sharers), installs: brought, perCame: came ? brought / came : null },
  };
}

/**
 * The Campaigns tab: every tag in D1's campaigns list (zeros when never
 * counted) and any counted tag no longer listed, most opened first.
 * `missing` lists the new tables the database lacks: without campaign_daily
 * there are no counts, without campaigns no list (`listReady` false).
 */
export function campaignsModel(r, days, missing = []) {
  const ready = !missing.includes('campaign_daily');
  const listReady = !missing.includes('campaigns');
  const rows = ready ? (r.campaignDaily ?? []) : [];
  const tags = new Map();
  const list = listReady ? campaignListOf(r.campaignList) : [];
  list.forEach((c, order) => tags.set(c.tag, { tag: c.tag, note: c.note, added: c.added, listed: true, order, opens: 0, downloads: 0, lastDay: null }));
  for (const x of rows) {
    const tag = String(x.tag);
    if (!tags.has(tag)) tags.set(tag, { tag, note: '', added: null, listed: false, order: Infinity, opens: 0, downloads: 0, lastDay: null });
    const t = tags.get(tag);
    if (x.step === 'open') t.opens += n(x.n);
    else if (x.step === 'download') t.downloads += n(x.n);
    t.lastDay = later(t.lastDay, x.last_day ?? null);
  }
  const sorted = [...tags.values()].sort((a, b) => b.opens - a.opens || b.downloads - a.downloads || a.order - b.order || a.tag.localeCompare(b.tag));
  return {
    ready,
    listReady,
    tags: sorted.map(({ order, ...t }) => t),
    opens: spread(days, rows.filter((x) => x.step === 'open')),
    downloads: spread(days, rows.filter((x) => x.step === 'download')),
  };
}

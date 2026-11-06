// Turns the D1 and Analytics Engine rows of scripts/data.mjs into one model the
// screens draw: totals, daily series filled for every day of the window, and
// ranked lists. Pure: rows in, plain objects out. Device ids never enter it.

import { androidName, plural } from './paint.mjs';
import { windowOf } from './queries.mjs';

const n = (v) => Number(v ?? 0) || 0;

/** Day series over the window: `rows` hold `day` and the value at `key`. */
function series(days, rows, key = 'n') {
  const by = new Map();
  for (const r of rows) by.set(r.day, (by.get(r.day) ?? 0) + n(r[key]));
  return days.map((d) => by.get(d) ?? 0);
}

function parseJson(text, fallback) {
  if (typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

const INSTALLERS = {
  '': 'adb or unknown',
  'com.android.vending': 'Play Store',
  'com.google.android.packageinstaller': 'Package installer (APK)',
  'com.android.packageinstaller': 'Package installer (APK)',
  'com.phonecando.app': 'PhoneCanDo updater',
};

/** Installer package → what it means. */
export const installerName = (pkg) => INSTALLERS[pkg ?? ''] ?? pkg;

/** Value at percentile `p` (0..1) of a { bucket, n } histogram (bucket = lower bound in ms). */
export function histPercentile(hist, p) {
  const total = hist.reduce((a, h) => a + n(h.n), 0);
  if (!total) return null;
  let seen = 0;
  for (const h of hist) {
    seen += n(h.n);
    if (seen >= p * total) return n(h.bucket) + 250; // the bucket's middle
  }
  return n(hist[hist.length - 1].bucket) + 250;
}

/** Sums `rows` by `key` into [{ label, value }], largest first. */
function grouped(rows, key, value = 'n') {
  const by = new Map();
  for (const r of rows) by.set(r[key], (by.get(r[key]) ?? 0) + n(r[value]));
  return [...by].map(([label, v]) => ({ label: String(label ?? ''), value: v })).sort((a, b) => b.value - a.value);
}

/** A running total per day (stars): days without a row repeat the last value; days before the first are null. */
function carried(days, rows, key) {
  const by = new Map(rows.map((r) => [r.day, n(r[key])]));
  const sorted = rows.map((r) => r.day).sort();
  return days.map((d) => {
    const last = sorted.filter((x) => x <= d).pop();
    return last === undefined ? null : by.get(last);
  });
}

/** Per-day increases of a cumulative series (GitHub counters); the first day needs the day before. */
function deltas(days, rows, key) {
  const by = new Map(rows.map((r) => [r.day, n(r[key])]));
  const all = [...by.keys()].sort();
  return days.map((d) => {
    const prev = all.filter((x) => x < d).pop();
    return by.has(d) && prev !== undefined ? Math.max(0, by.get(d) - by.get(prev)) : 0;
  });
}

function siteModel(r, days) {
  const countries = new Map();
  for (const row of r.siteCountries ?? []) {
    const c = countries.get(row.country) ?? { label: row.country || 'unknown', views: 0, downloads: 0 };
    if (row.kind === 'view') c.views += n(row.n);
    else c.downloads += n(row.n);
    countries.set(row.country, c);
  }
  const totals = { views: 0, downloads: {}, firstDay: null };
  for (const t of r.siteTotals ?? []) {
    if (t.kind === 'view') totals.views += n(t.n);
    else totals.downloads[t.what] = n(t.n);
    if (!totals.firstDay || t.first_day < totals.firstDay) totals.firstDay = t.first_day;
  }
  const daily = r.siteDaily ?? [];
  return {
    views: series(days, daily.filter((x) => x.kind === 'view')),
    downloads: series(days, daily.filter((x) => x.kind === 'download')),
    paths: (r.sitePaths ?? []).map((x) => ({ label: x.path, value: n(x.n) })),
    countries: [...countries.values()].sort((a, b) => b.views + b.downloads - (a.views + a.downloads)).slice(0, 10),
    channels: (r.siteChannels ?? []).map((x) => ({ label: x.channel, value: n(x.n) })),
    totals,
  };
}

function aeModel(ae) {
  if (!ae) return { available: false, note: 'Analytics Engine detail was not queried' };
  const r = ae.results ?? {};
  const have = Object.keys(r).length > 0;
  const dl = r.downloadClients ?? [];
  const people = dl.filter((x) => x.client !== 'bot');
  return {
    available: have,
    note: ae.problem ?? null,
    viewClients: (r.viewClients ?? []).map((x) => ({ label: x.client || 'other', value: n(x.n) })),
    viewReferrers: (r.viewReferrers ?? []).map((x) => ({ label: x.ref, value: n(x.n) })),
    downloadClients: grouped(dl, 'client'),
    downloadPeople: grouped(people, 'channel'),
    downloadBots: dl.filter((x) => x.client === 'bot').reduce((a, x) => a + n(x.n), 0),
    downloadAndroid: (r.downloadAndroid ?? []).map((x) => ({ label: x.android ? `Android ${x.android}` : 'not Android / unknown', value: n(x.n) })),
    downloadReferrers: (r.downloadReferrers ?? []).map((x) => ({ label: x.ref, value: n(x.n) })),
  };
}

function githubModel(r, days) {
  const repo = r.githubRepo ?? [];
  const latest = repo[repo.length - 1] ?? null;
  const assets = r.githubAssets ?? [];
  return {
    latest: latest && { day: latest.day, stars: n(latest.stars), forks: n(latest.forks), watchers: n(latest.watchers), views: latest.views, uniques: latest.view_uniques },
    stars: carried(days, repo, 'stars'),
    assetsDay: assets[0]?.day ?? null,
    assets: assets.map((a) => ({ tag: a.tag, asset: a.asset, downloads: n(a.download_count) })),
    downloadsPerDay: deltas(days, r.githubDaily ?? [], 'total'),
    checksPerDay: deltas(days, r.githubDaily ?? [], 'checks'),
  };
}

/** The whole model for one refresh. */
export function buildModel({ results: r, ae = null, now, days, testers = false, source = '', database = '', rowsRead = 0 }) {
  const w = windowOf(now, days);
  const t = r.totals?.[0] ?? {};
  const sd = r.sessionsDaily ?? [];
  const sum = (key) => sd.reduce((a, x) => a + n(x[key]), 0);
  const eventNames = (r.eventNames ?? []).map((x) => ({ label: x.name, value: n(x.n), devices: n(x.devices) }));
  const errorsDaily = r.errorsDaily ?? [];
  const errorKinds = grouped(errorsDaily, 'kind');
  const boot = (r.boot ?? []).map((h) => ({ bucket: n(h.bucket), n: n(h.n) }));

  return {
    meta: { now, days, since: w.since, sinceDay: w.sinceDay, today: w.today, dayList: w.days, testers, source, database, rowsRead },
    totals: {
      devices: n(t.devices),
      devicesActive: n(t.devices_active),
      devicesNew: n(t.devices_new),
      testers: n(t.testers),
      installs: n(t.installs),
      installsNew: n(t.installs_new),
      reports: n(t.reports),
      reportsNew: n(t.reports_new),
      sessions: sum('sessions'),
      sessionDevices: n(r.activeDevices?.[0]?.devices),
      events: eventNames.reduce((a, e) => a + e.value, 0),
      errors: errorKinds.reduce((a, k) => a + k.value, 0),
      errorDevices: n(r.errorDevices?.[0]?.devices),
    },
    daily: {
      devices: series(w.days, sd, 'devices'),
      sessions: series(w.days, sd, 'sessions'),
      events: series(w.days, r.eventsDaily ?? []),
      errors: series(w.days, errorsDaily),
    },
    health: {
      engine: { ok: sum('engine_ok'), known: sum('engine_known') },
      a11y: { ok: sum('a11y_on'), known: sum('a11y_known') },
      battery: { ok: sum('battery_ok'), known: sum('battery_known') },
      fgService: { ok: sum('fg_ok'), known: sum('fg_known') },
      trimmed: { ok: sum('trimmed'), known: sum('sessions') },
      trims: sum('trims'),
      boot: { hist: boot, p50: histPercentile(boot, 0.5), p90: histPercentile(boot, 0.9), count: boot.reduce((a, h) => a + h.n, 0) },
      exitCodes: (r.exitCodes ?? []).map((x) => ({ label: `exit ${x.code}`, value: n(x.n), note: plural(n(x.devices), 'device') })),
    },
    installs: {
      channels: (r.channels ?? []).map((x) => ({ label: x.channel, value: n(x.n) })),
      sources: grouped((r.sources ?? []).map((x) => ({ label: installerName(x.source), n: x.n })), 'label'),
      versions: (r.versions ?? []).map((x) => ({ label: `v${x.version} · ${x.channel}`, value: n(x.n) })),
    },
    devices: {
      models: (r.models ?? []).map((x) => ({ label: `${x.manufacturer} ${x.model}`, value: n(x.n) })),
      android: (r.android ?? []).map((x) => ({ label: androidName(n(x.sdk_int)), value: n(x.n) })),
      ram: (r.ram ?? []).map((x) => ({ label: `${n(x.ram_gb)} GB`, value: n(x.n) })),
      abis: (r.abis ?? []).map((x) => ({ label: x.abi, value: n(x.n) })),
      countries: (r.countries ?? []).map((x) => ({ label: x.country || 'unknown', value: n(x.n) })),
      locales: (r.locales ?? []).map((x) => ({ label: x.locale, value: n(x.n) })),
    },
    events: { names: eventNames },
    errors: {
      kinds: errorKinds,
      keys: (r.errorKeys ?? []).map((x) => ({
        key: x.error_key,
        kind: x.kind,
        className: x.class_name,
        version: x.version,
        message: x.message ?? '',
        frames: parseJson(x.frames, []).filter((f) => typeof f === 'string'),
        count: n(x.n),
        devices: n(x.devices),
        first: n(x.first),
        last: n(x.last),
      })),
    },
    reports: (r.reports ?? []).map((x) => {
      const d = parseJson(x.device, {});
      return {
        id: x.report_id,
        received: n(x.received),
        version: x.version,
        channel: x.channel,
        note: x.note ?? '',
        events: n(x.events_n),
        logTail: x.log_tail ?? '',
        device: {
          name: [d.manufacturer, d.model].filter(Boolean).join(' ') || 'unknown device',
          android: typeof d.sdkInt === 'number' ? androidName(d.sdkInt) : null,
          ramGb: d.ramGb ?? null,
          locale: d.locale ?? null,
          installer: d.installSource === undefined ? null : installerName(d.installSource ?? ''),
        },
      };
    }),
    site: siteModel(r, w.days),
    ae: aeModel(ae),
    github: githubModel(r, w.days),
  };
}

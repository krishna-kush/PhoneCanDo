// Sample D1 and Analytics Engine rows for the data script's tests, keyed by
// the statement names in queries.mjs. NOTE, LOG and FRAME are details that the
// build report must never print.

const DAY_MS = 86_400_000;
export const NOW = Date.parse('2026-11-06T12:00:00Z');
export const NOTE = 'Terminal froze after rotating the phone';
export const LOG = 'serve: listening on 127.0.0.1:4097\nserve: worker exited with code 137';
export const FRAME = 'at renderChat (<app>/ChatWebScreen.tsx:88:12)';

const day = (back) => new Date(NOW - back * DAY_MS).toISOString().slice(0, 10);

export function sampleResults() {
  return {
    totals: [{ devices: 42, devices_active: 30, devices_new: 9, testers: 2, installs: 51, installs_new: 12, reports: 3, reports_new: 2 }],
    sessionsDaily: [
      { day: day(2), sessions: 40, devices: 20, engine_ok: 38, engine_known: 40, a11y_on: 12, a11y_known: 40, battery_ok: 30, battery_known: 40, fg_ok: 39, fg_known: 40, trimmed: 2, trims: 5 },
      { day: day(0), sessions: 60, devices: 25, engine_ok: 59, engine_known: 60, a11y_on: 20, a11y_known: 60, battery_ok: 45, battery_known: 60, fg_ok: 60, fg_known: 60, trimmed: 1, trims: 1 },
    ],
    activeDevices: [{ devices: 28 }],
    boot: [
      { bucket: 1500, n: 30 },
      { bucket: 2500, n: 50 },
      { bucket: 9000, n: 15 },
      { bucket: 30000, n: 5 },
    ],
    exitCodes: [{ code: 137, n: 4, devices: 3 }],
    eventsDaily: [
      { day: day(2), n: 300 },
      { day: day(0), n: 500 },
    ],
    eventNames: [
      { name: 'chat.open', n: 400, devices: 25 },
      { name: 'tool.mobile_click', n: 250, devices: 9 },
      { name: 'update.check.none', n: 150, devices: 28 },
    ],
    errorsDaily: [
      { day: day(1), kind: 'js', n: 6, devices: 4 },
      { day: day(0), kind: 'native', n: 2, devices: 1 },
    ],
    errorDevices: [{ devices: 5 }],
    errorKeys: [
      { error_key: 'a'.repeat(64), kind: 'js', class_name: 'TypeError', version: '0.1.3', message: "Cannot read properties of undefined (reading 'x')", frames: JSON.stringify([FRAME]), n: 6, devices: 4, first: NOW - 2 * DAY_MS, last: NOW - 3_600_000 },
      { error_key: 'b'.repeat(64), kind: 'native', class_name: 'java.lang.IllegalStateException', version: '0.1.3', message: 'service not started', frames: '[]', n: 2, devices: 1, first: NOW - DAY_MS, last: NOW - DAY_MS },
    ],
    reports: [
      {
        report_id: '0f3b1c2d-1111-4222-8333-444455556666',
        received: NOW - 7_200_000,
        version: '0.1.3',
        channel: 'full',
        note: NOTE,
        events_n: 12,
        log_tail: LOG,
        device: JSON.stringify({ manufacturer: 'Google', model: 'Pixel 9', sdkInt: 36, abi: 'arm64-v8a', ramGb: 12, locale: 'en-IN', installSource: 'com.phonecando.app', tester: false }),
      },
    ],
    channels: [
      { channel: 'full', n: 31 },
      { channel: 'lite', n: 20 },
    ],
    sources: [
      { source: 'com.google.android.packageinstaller', n: 30 },
      { source: '', n: 15 },
      { source: 'com.phonecando.app', n: 6 },
    ],
    versions: [
      { version: '0.1.3', channel: 'full', n: 25 },
      { version: '0.1.2', channel: 'lite', n: 10 },
    ],
    models: [
      { manufacturer: 'Google', model: 'Pixel 9', n: 8 },
      { manufacturer: 'samsung', model: 'SM-S928B', n: 5 },
    ],
    android: [
      { sdk_int: 36, n: 18 },
      { sdk_int: 34, n: 12 },
    ],
    ram: [
      { ram_gb: 8, n: 14 },
      { ram_gb: 12, n: 16 },
    ],
    abis: [{ abi: 'arm64-v8a', n: 30 }],
    countries: [
      { country: 'IN', n: 20 },
      { country: '', n: 2 },
    ],
    locales: [{ locale: 'en-IN', n: 19 }],
    siteDaily: [
      { day: day(1), kind: 'view', n: 40 },
      { day: day(0), kind: 'view', n: 60 },
      { day: day(0), kind: 'download', n: 12 },
    ],
    sitePaths: [
      { path: '/', n: 90 },
      { path: '/privacy/', n: 10 },
    ],
    siteCountries: [
      { country: 'IN', kind: 'view', n: 70 },
      { country: 'IN', kind: 'download', n: 9 },
      { country: 'US', kind: 'view', n: 30 },
    ],
    siteChannels: [
      { channel: 'lite', n: 8 },
      { channel: 'full', n: 4 },
    ],
    siteTotals: [
      { kind: 'view', what: '', n: 100, first_day: day(1) },
      { kind: 'download', what: 'full', n: 4, first_day: day(0) },
      { kind: 'download', what: 'lite', n: 8, first_day: day(0) },
    ],
    githubAssets: [
      { day: day(0), tag: 'v0.1.3', asset: 'latest.json', download_count: 900 },
      { day: day(0), tag: 'v0.1.3', asset: 'phonecando-0.1.3-full-arm64.apk', download_count: 40 },
    ],
    githubDaily: [
      { day: day(2), total: 800, checks: 760 },
      { day: day(1), total: 880, checks: 830 },
      { day: day(0), total: 940, checks: 900 },
    ],
    githubRepo: [
      { day: day(3), stars: 10, forks: 1, watchers: 2, views: null, view_uniques: null, clones: null, clone_uniques: null },
      { day: day(0), stars: 14, forks: 2, watchers: 3, views: 120, view_uniques: 30, clones: null, clone_uniques: null },
    ],
  };
}

export function sampleAe() {
  return {
    results: {
      viewClients: [
        { client: 'android', n: 50 },
        { client: 'bot', n: 20 },
      ],
      viewReferrers: [{ ref: 'news.ycombinator.com', n: 15 }],
      downloadClients: [
        { channel: 'lite', client: 'android', n: 7 },
        { channel: 'full', client: 'desktop', n: 3 },
        { channel: 'lite', client: 'bot', n: 6 },
      ],
      downloadAndroid: [
        { android: '16', n: 5 },
        { android: '', n: 3 },
      ],
      downloadReferrers: [{ ref: 'github.com', n: 4 }],
    },
  };
}

// Valid sample ids, rows and requests for tests. Every builder returns a fresh
// object, and `over` replaces top-level fields, so tests state only what they
// care about. All times derive from T0.

import type { HttpRequest } from '../core/op.ts';
import type {
  DeviceRow,
  DownloadPoint,
  ErrorRow,
  EventRow,
  GithubAssetDailyRow,
  GithubRepoDailyRow,
  InstallRow,
  PagePoint,
  ReportRow,
  SessionRow,
} from '../core/schema/rows.ts';
import type {
  AppWire,
  BatchRequest,
  DeviceWire,
  ErrorWire,
  EventWire,
  ForgetRequest,
  HitRequest,
  IdentityWire,
  ReportRequest,
  SessionWire,
} from '../core/schema/wire.ts';
import type { BatchWrite } from '../core/store.ts';

/** 2026-11-01T00:00:00Z: the base time of every fixture. */
export const T0 = 1_793_491_200_000;
/** One day in milliseconds. */
export const DAY_MS = 86_400_000;

/** Lowercase UUID v4 install ids. */
export const INSTALL_ID = '6f1c2a3b-4d5e-4f60-8a1b-2c3d4e5f6a7b';
export const INSTALL_ID_2 = '7a2d3b4c-5e6f-4a71-9b2c-3d4e5f6a7b8c';
export const INSTALL_ID_3 = '1e9f0a1b-2c3d-4e4f-a5a6-b7c8d9e0f1a2';
/** Lowercase UUID v4 session ids. */
export const SESSION_ID = '8b3e4c5d-6f7a-4b82-ac3d-4e5f6a7b8c9d';
export const SESSION_ID_2 = '9c4f5d6e-7a8b-4c93-bd4e-5f6a7b8c9dae';
export const SESSION_ID_3 = '2fa01b2c-3d4e-4f50-b6b7-c8d9e0f1a2b3';
/** Lowercase UUID v4 error ids. */
export const ERROR_ID = 'ad5a6e7f-8b9c-4da4-8e5f-6a7b8c9daebf';
export const ERROR_ID_2 = 'be6b7f8a-9cad-4eb5-9f6a-7b8c9daebfc0';
export const ERROR_ID_3 = '30b12c3d-4e5f-4061-87c8-d9e0f1a2b3c4';
export const ERROR_ID_4 = '41c23d4e-5f60-4172-98d9-e0f1a2b3c4d5';
/** Lowercase UUID v4 report ids. */
export const REPORT_ID = 'cf7c8a9b-adbe-4fc6-a07b-8c9daebfc0d1';
export const REPORT_ID_2 = '52d34e5f-6071-4283-a9e0-f1a2b3c4d5e6';
/** Lowercase UUID v4 batch id. */
export const BATCH_ID = 'd08d9bac-becf-40d7-b18c-9daebfc0d1e2';

/** 64 lowercase hex ids (shape of a SHA-256 hex digest). */
export const DEVICE_ID = 'a1'.repeat(32);
export const DEVICE_ID_2 = 'b2'.repeat(32);
export const HW_HASH = 'c3'.repeat(32);
export const DRM_ID = 'd4'.repeat(32);
export const DRM_ID_2 = 'e5'.repeat(32);
/** A plausible error_key (the op computes real ones). */
export const ERROR_KEY = 'f6'.repeat(32);

// Device ownership (core/schema/limits.ts HASH_PEPPER): proof =
// SHA-256(HASH_PEPPER.forget + ANDROID_ID), verifier = SHA-256(proof as its
// lowercase hex string). Precomputed so fixtures stay synchronous;
// testkit/ctx.test.ts recomputes them with Web Crypto.
/** The raw ANDROID_ID behind DEVICE_PROOF (never sent; documents the derivation). */
export const ANDROID_ID = '0123456789abcdef';
/** SHA-256('phonecando.forget.v1:' + ANDROID_ID): what forget sends for DEVICE_ID. */
export const DEVICE_PROOF = 'b015d2cbd0b2d37b0ceafac652487fa5a9f8192d612045ec69ca1ec021d1519a';
/** SHA-256(DEVICE_PROOF): what every batch of DEVICE_ID carries, and the stored devices.verifier. */
export const DEVICE_VERIFIER = '3e80f3f0ed72660017a5a267d7850c09c31f192f4dbb54fe69cb2b1205b720d4';
/** The raw ANDROID_ID behind DEVICE_PROOF_2. */
export const ANDROID_ID_2 = 'fedcba9876543210';
/** Forget proof of DEVICE_ID_2. */
export const DEVICE_PROOF_2 = '55cf9f4264b00cc2a6001febdef7080ff0aca2711e7eae6f0437b65292126b40';
/** Verifier of DEVICE_ID_2: SHA-256(DEVICE_PROOF_2). */
export const DEVICE_VERIFIER_2 = 'c57d98e3ee1219471d8e84e588e5d25e08c9972f8f3b86d75dd24f83497d5577';
/** A proof nobody's device owns (an attacker's guess): SHA-256('stranger'). */
export const STRANGER_PROOF = '8aca4f36774f82a67c507cb9c96679482e2cc767f2d38502269557a566b092fb';
/** SHA-256(STRANGER_PROOF): a well-formed verifier that matches no fixture device. */
export const STRANGER_VERIFIER = 'a6510c843d0ba18fc7430941efed86256b23d241f80bd6c3b6cf38624adefff5';

/** Production site host and origin. */
export const SITE_HOST = 'phonecando.app';
export const SITE_ORIGIN = `https://${SITE_HOST}`;

/** User-Agent strings, one per UaClass. */
export const UA = {
  android:
    'Mozilla/5.0 (Linux; Android 16; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  other: 'NintendoBrowser/5.1',
} as const;

// ---------- storage rows ----------

/** A devices row (DEVICE_ID, DEVICE_VERIFIER) first and last seen at T0. */
export function deviceRow(over: Partial<DeviceRow> = {}): DeviceRow {
  return {
    device_id: DEVICE_ID,
    verifier: DEVICE_VERIFIER,
    hw_hash: HW_HASH,
    drm_id: null,
    manufacturer: 'Google',
    model: 'Pixel 8',
    sdk_int: 36,
    abi: 'arm64-v8a',
    ram_gb: 8,
    locale: 'en-IN',
    country: 'IN',
    asn: 24560,
    tester: 0,
    first_seen: T0,
    last_seen: T0,
    ...over,
  };
}

/** An installs row for (INSTALL_ID, DEVICE_ID) at version 0.1.2. */
export function installRow(over: Partial<InstallRow> = {}): InstallRow {
  return {
    install_id: INSTALL_ID,
    device_id: DEVICE_ID,
    channel: 'lite',
    install_source: 'com.android.chrome',
    first_version: '0.1.2',
    last_version: '0.1.2',
    last_version_code: 12,
    first_seen: T0,
    last_seen: T0,
    ...over,
  };
}

/** A sessions row received at T0 that started a minute earlier. */
export function sessionRow(over: Partial<SessionRow> = {}): SessionRow {
  return {
    session_id: SESSION_ID,
    install_id: INSTALL_ID,
    device_id: DEVICE_ID,
    version: '0.1.2',
    version_code: 12,
    channel: 'lite',
    started: T0 - 60_000,
    ended: null,
    boot_ms: 1800,
    engine_ok: 1,
    engine_exit_code: null,
    engine_stderr_tail: null,
    low_memory_trims: 0,
    battery_opt_ignored: 1,
    fg_service_ok: 1,
    a11y_on: 0,
    counters: '{"tool.mobile_click":3}',
    country: 'IN',
    received: T0,
    ...over,
  };
}

/** An events row (SESSION_ID, seq 1) received at T0. */
export function eventRow(over: Partial<EventRow> = {}): EventRow {
  return {
    session_id: SESSION_ID,
    seq: 1,
    install_id: INSTALL_ID,
    device_id: DEVICE_ID,
    name: 'chat.open',
    props: null,
    ts_client: T0 - 1000,
    ts: T0 - 1000,
    received: T0,
    ...over,
  };
}

/** An errors row (ERROR_ID) in SESSION_ID received at T0. */
export function errorRow(over: Partial<ErrorRow> = {}): ErrorRow {
  return {
    error_id: ERROR_ID,
    error_key: ERROR_KEY,
    kind: 'js',
    session_id: SESSION_ID,
    seq: 2,
    install_id: INSTALL_ID,
    device_id: DEVICE_ID,
    version: '0.1.2',
    class_name: 'TypeError',
    message: 'undefined is not a function',
    frames: '["at render (index.android.bundle:1:2048)"]',
    ts_client: T0 - 500,
    ts: T0 - 500,
    received: T0,
    ...over,
  };
}

/** A reports row (REPORT_ID) received at T0. */
export function reportRow(over: Partial<ReportRow> = {}): ReportRow {
  return {
    report_id: REPORT_ID,
    install_id: INSTALL_ID,
    device_id: DEVICE_ID,
    session_id: SESSION_ID,
    version: '0.1.2',
    channel: 'lite',
    note: 'terminal froze after rotate',
    events: '[]',
    log_tail: null,
    device: JSON.stringify(deviceWire()),
    received: T0,
    ...over,
  };
}

/** A github_assets_daily row for the lite APK of v0.1.2. */
export function githubAssetRow(over: Partial<GithubAssetDailyRow> = {}): GithubAssetDailyRow {
  return { day: '2026-11-01', tag: 'v0.1.2', asset: 'phonecando-0.1.2-lite-arm64.apk', download_count: 3, ...over };
}

/** A github_repo_daily row without traffic numbers. */
export function githubRepoRow(over: Partial<GithubRepoDailyRow> = {}): GithubRepoDailyRow {
  return {
    day: '2026-11-01',
    stars: 12,
    forks: 2,
    watchers: 3,
    views: null,
    view_uniques: null,
    clones: null,
    clone_uniques: null,
    referrers: null,
    ...over,
  };
}

/** A page view of / from India on T0's UTC day. */
export function pagePoint(over: Partial<PagePoint> = {}): PagePoint {
  return { day: '2026-11-01', path: '/', refHost: null, country: 'IN', uaClass: 'android', ...over };
}

/** A lite download from India on T0's UTC day. */
export function downloadPoint(over: Partial<DownloadPoint> = {}): DownloadPoint {
  return { day: '2026-11-01', channel: 'lite', version: '0.1.2', country: 'IN', androidMajor: 16, refHost: null, uaClass: 'android', ...over };
}

/** One device, one install, one session with one event and one error. */
export function batchWrite(over: Partial<BatchWrite> = {}): BatchWrite {
  return {
    device: deviceRow(),
    install: installRow(),
    sessions: [sessionRow()],
    events: [eventRow()],
    errors: [errorRow()],
    ...over,
  };
}

// ---------- wire requests ----------

/** Identity of DEVICE_ID (with its DEVICE_VERIFIER), without a drm id. */
export function identityWire(over: Partial<IdentityWire> = {}): IdentityWire {
  return { installId: INSTALL_ID, deviceId: DEVICE_ID, hwHash: HW_HASH, deviceVerifier: DEVICE_VERIFIER, ...over };
}

/** A Pixel 8 on Android 16. */
export function deviceWire(over: Partial<DeviceWire> = {}): DeviceWire {
  return {
    manufacturer: 'Google',
    model: 'Pixel 8',
    sdkInt: 36,
    abi: 'arm64-v8a',
    ramGb: 8,
    locale: 'en-IN',
    installSource: 'com.android.chrome',
    tester: false,
    ...over,
  };
}

/** Lite 0.1.2. */
export function appWire(over: Partial<AppWire> = {}): AppWire {
  return { version: '0.1.2', versionCode: 12, channel: 'lite', ...over };
}

/** SESSION_ID, started a minute before T0. */
export function sessionWire(over: Partial<SessionWire> = {}): SessionWire {
  return {
    sessionId: SESSION_ID,
    startedAt: T0 - 60_000,
    bootMs: 1800,
    engineOk: true,
    lowMemoryTrims: 0,
    batteryOptIgnored: true,
    fgServiceOk: true,
    a11yOn: false,
    counters: { 'tool.mobile_click': 3 },
    ...over,
  };
}

/** `chat.open` at seq 1 in SESSION_ID. */
export function eventWire(over: Partial<EventWire> = {}): EventWire {
  return { sessionId: SESSION_ID, seq: 1, ts: T0 - 1000, name: 'chat.open', ...over };
}

/** A JS TypeError (ERROR_ID) at seq 3 in SESSION_ID. */
export function errorWire(over: Partial<ErrorWire> = {}): ErrorWire {
  return {
    errorId: ERROR_ID,
    sessionId: SESSION_ID,
    seq: 3,
    ts: T0 - 500,
    kind: 'js',
    className: 'TypeError',
    message: 'undefined is not a function',
    frames: ['at render (index.android.bundle:1:2048)', 'at commit (index.android.bundle:1:4096)'],
    ...over,
  };
}

/** A valid BatchRequest sent at T0: one session, two events, one error. */
export function batchRequest(over: Partial<BatchRequest> = {}): BatchRequest {
  return {
    schema: 1,
    batchId: BATCH_ID,
    sentAt: T0,
    identity: identityWire(),
    device: deviceWire(),
    app: appWire(),
    sessions: [sessionWire()],
    events: [
      eventWire(),
      eventWire({ seq: 2, ts: T0 - 900, name: 'terminal.open', props: { source: 'tab', cols: 80, ime: true } }),
    ],
    errors: [errorWire()],
    ...over,
  };
}

/** A valid ReportRequest with one event and a short log tail. */
export function reportRequest(over: Partial<ReportRequest> = {}): ReportRequest {
  return {
    schema: 1,
    reportId: REPORT_ID,
    identity: identityWire(),
    device: deviceWire(),
    app: appWire(),
    sessionId: SESSION_ID,
    note: 'terminal froze after rotate',
    events: [eventWire()],
    logTail: 'serve: listening on 127.0.0.1:4097\n',
    ...over,
  };
}

/** A valid ForgetRequest for DEVICE_ID with its DEVICE_PROOF. */
export function forgetRequest(over: Partial<ForgetRequest> = {}): ForgetRequest {
  return { schema: 1, deviceId: DEVICE_ID, deviceProof: DEVICE_PROOF, ...over };
}

/** A page view of /install referred by a search engine. */
export function hitRequest(over: Partial<HitRequest> = {}): HitRequest {
  return { path: '/install', ref: 'https://www.google.com/search?q=phonecando', ...over };
}

/** HttpRequest overrides; `headers` is merged field by field. */
export type HttpRequestOverrides = Partial<Omit<HttpRequest, 'headers'>> & { headers?: Partial<HttpRequest['headers']> };

/** A POST from Android Chrome to the production host, not rate limited; override what the test needs. */
export function httpRequest(over: HttpRequestOverrides = {}): HttpRequest {
  const { headers, ...rest } = over;
  return {
    method: 'POST',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    limited: false,
    ...rest,
    headers: {
      userAgent: UA.android,
      referer: null,
      origin: null,
      host: SITE_HOST,
      contentType: 'application/json',
      ...headers,
    },
  };
}

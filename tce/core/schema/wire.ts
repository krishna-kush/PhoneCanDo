// What travels over HTTP between a client (the app, the site) and a host.
// camelCase on the wire; rows.ts holds the snake_case storage shapes.
// Every request that carries identity has `schema: SCHEMA_VERSION`.

export type Channel = 'full' | 'lite' | 'play';
export type ErrorKind = 'js' | 'native' | 'engine';
export type PropValue = string | number | boolean;

/**
 * Who is sending. All ids are opaque to the server; it only checks their shape.
 *   installId  lowercase UUID v4, made on first launch, resettable; dies with uninstall.
 *   deviceId   64 lowercase hex: SHA-256(HASH_PEPPER.device + ANDROID_ID). Survives reinstall.
 *   hwHash     64 lowercase hex: SHA-256(HASH_PEPPER.hardware + build fingerprint, model,
 *              RAM, screen ...). Survives factory reset; not unique across identical units.
 *   drmId      64 lowercase hex: SHA-256(HASH_PEPPER.drm + Widevine id). Absent unless enabled.
 *   deviceVerifier  64 lowercase hex: SHA-256(proof), proof = SHA-256(HASH_PEPPER.forget +
 *              ANDROID_ID). The server pins the first verifier per device and rejects
 *              writes that carry another one (see HASH_PEPPER in limits.ts).
 */
export interface IdentityWire {
  installId: string;
  deviceId: string;
  hwHash: string;
  drmId?: string;
  deviceVerifier: string;
}

export interface DeviceWire {
  manufacturer: string;
  model: string;
  sdkInt: number;
  abi: string;
  /** Total RAM rounded to whole GB. */
  ramGb: number;
  /** BCP 47, e.g. `en-IN`. */
  locale: string;
  /** Installer package name; null for adb or unknown. */
  installSource: string | null;
  /** One of our own test phones; excluded from user counts. */
  tester: boolean;
}

export interface AppWire {
  version: string;
  versionCode: number;
  channel: Channel;
}

/** One app process run. Re-sent with more fields as it progresses; the server merges. */
export interface SessionWire {
  sessionId: string;
  startedAt: number;
  /**
   * The app build this session ran, stamped when it started. A session queued
   * before an update is flushed by the updated process; without these the
   * server would attribute it to the batch's (newer) app.
   */
  version?: string;
  versionCode?: number;
  channel?: Channel;
  endedAt?: number;
  bootMs?: number;
  engineOk?: boolean;
  engineExitCode?: number;
  engineStderrTail?: string;
  lowMemoryTrims?: number;
  batteryOptIgnored?: boolean;
  fgServiceOk?: boolean;
  a11yOn?: boolean;
  /** Free-form counters, e.g. { "tool.mobile_click": 4, "session.create": 1 }. */
  counters?: Record<string, number>;
}

export interface EventWire {
  sessionId: string;
  /** Per-session sequence shared by events and errors; orders them. */
  seq: number;
  /** Client clock, epoch ms. The server also stores a skew-corrected time. */
  ts: number;
  name: string;
  props?: Record<string, PropValue>;
}

export interface ErrorWire {
  /** Client-made UUID; makes resends idempotent. */
  errorId: string;
  /** Null for a native crash recorded before JS knew the session. */
  sessionId: string | null;
  seq: number | null;
  ts: number;
  kind: ErrorKind;
  className: string;
  message: string;
  /** Top frames, home-directory paths already redacted by the client. */
  frames: string[];
  /** App version that raised it, when it differs from the batch's app version. */
  version?: string;
}

export interface BatchRequest {
  schema: 1;
  /** Client-made UUID per flush; for tracing only (writes are idempotent anyway). */
  batchId: string;
  /** Client clock when sent; server derives clock skew from it. */
  sentAt: number;
  identity: IdentityWire;
  device: DeviceWire;
  app: AppWire;
  sessions: SessionWire[];
  events: EventWire[];
  errors: ErrorWire[];
}

export interface BatchResponse {
  serverTime: number;
  accepted: { sessions: number; events: number; errors: number };
  /** Events dropped because their name is not in the vocabulary. */
  droppedEvents: number;
}

export interface ReportRequest {
  schema: 1;
  reportId: string;
  identity: IdentityWire;
  device: DeviceWire;
  app: AppWire;
  sessionId: string | null;
  note?: string;
  /** Most recent events, oldest first. */
  events: EventWire[];
  /** Redacted tail of the engine log. */
  logTail?: string;
}

export interface ReportResponse {
  reportId: string;
  serverTime: number;
}

/**
 * Deletes every row of the device. `deviceProof` (64 hex, see HASH_PEPPER.forget)
 * must hash to the verifier pinned for `deviceId`; otherwise `not_found`.
 */
export interface ForgetRequest {
  schema: 1;
  deviceId: string;
  deviceProof: string;
}

export interface ForgetResponse {
  deleted: Record<string, number>;
}

/** Site page view (sendBeacon, same origin). Country comes from the edge. */
export interface HitRequest {
  path: string;
  /** document.referrer; only its host is kept. */
  ref?: string;
}

/**
 * GET /api/health — public, no identity, for the limit check run on every
 * build (scripts/check-limits.mjs). Ratios come from CAPACITY in limits.ts.
 */
export interface HealthResponse {
  serverTime: number;
  db: {
    /** Current database size; null when the backend cannot tell. */
    bytes: number | null;
    limitBytes: number;
    warnRatio: number;
    guardRatio: number;
  };
  /** The storage guard is refusing new telemetry right now. */
  ingestPaused: boolean;
  /**
   * Whether the retention cron deletes, the promised ages (RETENTION_DAYS), and
   * how old the oldest kept row of each table is, in whole days (null: empty).
   */
  retention: {
    enabled: boolean;
    days: { events: number; errors: number; reports: number };
    oldestDays: { events: number | null; errors: number | null; reports: number | null };
  };
}

/** Error body for every non-2xx JSON response. */
export interface ErrorBody {
  error: { code: string; message: string; field?: string; requestId?: string };
}

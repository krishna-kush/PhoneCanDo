// Every size cap in one place. The server rejects input over a body cap and
// truncates over a field cap; the client truncates before sending so a normal
// app never hits a rejection.

/** Wire schema version. A request with another value is `unsupported`. */
export const SCHEMA_VERSION = 1 as const;

// Why these sizes: the endpoints are public and unauthenticated, and the free
// D1 plan allows 100k row writes/day and 500 MB per database. A full batch
// costs ~480 row writes and a full report ≤ 16 KB, so one caller cannot burn
// the day's quota or fill the database with a handful of requests. A normal
// app flush is ~10 events.
export const LIMITS = {
  // Request bodies (bytes, checked by the host before JSON parsing).
  batchBodyBytes: 32 * 1024,
  reportBodyBytes: 16 * 1024,
  smallBodyBytes: 2 * 1024, // hit, forget

  // List lengths per request (over the cap = too_large).
  sessionsPerBatch: 10,
  eventsPerBatch: 200,
  errorsPerBatch: 20,
  reportEvents: 50,

  // Stored size of one report row after server re-serialization (events are
  // dropped oldest-first until it fits; numbers like 1e20 grow when re-serialized).
  reportRowBytes: 20 * 1024,
  // Reports accepted per UTC day across all devices; past it, report answers
  // `unavailable` so clients retry tomorrow. Bounds storage under abuse.
  reportsPerDay: 100,

  // Field lengths (characters; longer values are truncated).
  shortText: 64, // manufacturer, model, abi, locale, version, install source
  propKeyLength: 40,
  propStringLength: 200,
  propsKeys: 16,
  propsBytes: 512, // JSON size of one event's props after truncation
  counterKeys: 64,
  errorClass: 120,
  errorMessage: 200,
  errorFrames: 5,
  errorFrameLength: 200,
  stderrTail: 2048,
  logTail: 4 * 1024,
  reportNote: 500,
  pathLength: 200,
  hostLength: 100,

  // Client-side queue.
  queueCap: 500,
} as const;

/**
 * Days a row is kept, then deleted by the retention cron. There is no cold
 * storage yet: a backup is planned for when the database nears its limit
 * (tce/docs/planning/todo.md); scripts/check-limits.mjs warns before that.
 */
export const RETENTION_DAYS = { events: 90, errors: 180, reports: 90 } as const;

/** Rows deleted per table per retention run, bounded for the free plan's ~10 ms CPU. */
export const RETENTION_RUN = { rowsPerRun: 250 } as const;

/**
 * Free-plan capacity the limit check compares against (scripts/check-limits.mjs,
 * GET /v1/health). warnRatio: warn on every build; guardRatio: the D1 size
 * guard pauses ingest (stores/cloudflare/guard.ts uses the same 450 MB).
 */
export const CAPACITY = {
  dbLimitBytes: 500_000_000,
  d1RowsWrittenPerDay: 100_000,
  d1RowsReadPerDay: 5_000_000,
  workerRequestsPerDay: 100_000,
  aePointsPerDay: 100_000,
  warnRatio: 0.7,
  guardRatio: 0.9,
} as const;

/**
 * Version prefixes mixed into client-side hashes, so a raw id is never sent.
 *
 * Device ownership: the device sends `deviceVerifier` = SHA-256(proof) with
 * every batch, where proof = SHA-256(HASH_PEPPER.forget + ANDROID_ID). Every
 * hash here is lowercase hex of SHA-256 over the UTF-8 bytes of its input
 * string; the verifier hashes the 64-char lowercase hex proof string. The
 * server keeps the first verifier it sees for a device and refuses writes and
 * forgets that do not match. `deviceProof` itself is sent only by forget.
 * Knowing a deviceId (a different hash of ANDROID_ID) is not enough to write
 * as, or delete, that device.
 */
export const HASH_PEPPER = {
  device: 'phonecando.device.v1:',
  hardware: 'phonecando.hw.v1:',
  drm: 'phonecando.drm.v1:',
  forget: 'phonecando.forget.v1:',
} as const;

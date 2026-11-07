// Contract between the Kotlin side of phonecando-runner and the app's
// telemetry adapter (app/src/engine/telemetry/). Kotlin only records into
// SharedPreferences; it never does network.
//
// The module exposes two synchronous functions (re-exported by
// src/PhoneCanDoRunnerModule.ts; both return null when the native method is
// missing, e.g. an older build or web):
//   getTelemetrySnapshot(): TelemetryNativeSnapshot | null
//       Read-only peek; changes nothing.
//   consumeTelemetrySnapshot(): TelemetryNativeSnapshot | null
//       Same shape, but atomically (under one lock) zeroes every counter
//       (lowMemoryTrims, engine.starts/startFails/died/portSquats, toolCalls,
//       sessionCreates) and drains nativeCrashes. lastExitCode, lastDiedAt
//       and lastBootMs are cleared too, so each value is reported once.
//       lastStderrTail is NOT cleared: it stays until the next unexpected
//       exit replaces it, so a later user report can still attach it after
//       the process was killed. The on/off flag survives consume.
//   Read order for JS: peek (getTelemetrySnapshot), fold and persist, then
//   consume — so a kill between the two loses at most the few increments
//   made in that gap, not the whole period. State fields (installSource, batteryOptIgnored,
//       fgServiceRunning, a11yConnected, drmIdHash) are read live.
//   setTelemetryEnabled(enabled: boolean): void
//       Mirrors the user's on/off choice into native prefs. While off, no
//       engine event stream is opened just to count sessions.

export type NativeCrash = {
  /** UUID made when the crash was recorded; used as the error id. */
  id: string;
  /** Epoch ms. */
  ts: number;
  /** Throwable class name, e.g. java.lang.IllegalStateException. */
  className: string;
  /** Throwable message, truncated to 200 chars. */
  message: string;
  /** Top 5 stack frames as `Class.method(File.kt:line)`. */
  frames: string[];
  thread: string;
  /** App versionName at the time of the crash. */
  version: string;
};

export type EngineHealth = {
  /** Engine starts / failed starts since the last reset, all agents together. */
  starts: number;
  startFails: number;
  /** Times an engine exited without being asked to stop. */
  died: number;
  /** Exit code of the last unexpected exit, or null. */
  lastExitCode: number | null;
  /** Epoch ms of the last unexpected exit, or null (it may predate this process). */
  lastDiedAt: number | null;
  /**
   * Last ≤2 KB of that engine's stderr at that exit, paths (whole path, not just its
   * prefix) and secrets redacted, or null. Raw engine output can contain prompt
   * text, so the app sends it ONLY inside a user-initiated report, never in
   * automatic telemetry.
   */
  lastStderrTail: string | null;
  /** Times the preferred port was taken and another was picked. */
  portSquats: number;
  /** Ms from start request to the first healthy response, last start; or null. */
  lastBootMs: number | null;
};

export type TelemetryNativeSnapshot = {
  /**
   * Installer package name exactly as the platform reports it (getInstallSourceInfo /
   * getInstallerPackageName); null when unknown. adb installs may report a shell/installer package.
   */
  installSource: string | null;
  batteryOptIgnored: boolean;
  /** True while any agent's engine runs. */
  fgServiceRunning: boolean;
  a11yConnected: boolean;
  /**
   * onTrimMemory calls at RUNNING_LOW or worse, since the last reset. Android 14+
   * no longer delivers those levels, so this stays 0 there.
   */
  lowMemoryTrims: number;
  engine: EngineHealth;
  /**
   * Bridge route → calls since the last reset, keyed by route path with '/'
   * turned into '_' and the leading one dropped, e.g. { "notify": 2, "pce_act": 3 }.
   * Several mobile_* tools share one route (/pce/act), so this is per route.
   */
  toolCalls: Record<string, number>;
  /** Engine sessions created (from the engine event stream) since the last reset. */
  sessionCreates: number;
  /** Uncaught JVM crashes not yet consumed. */
  nativeCrashes: NativeCrash[];
  /**
   * Lowercase SHA-256 hex of "phonecando.drm.v1:" + hex(Widevine deviceUniqueId),
   * the same pepper as tce/core/schema/limits.ts HASH_PEPPER.drm. Always null
   * while the Kotlin build flag TELEMETRY_DRM_ID_ENABLED is false.
   */
  drmIdHash: string | null;
};

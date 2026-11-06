// Public surface of the client SDK. Pure TypeScript: no React Native, no
// Node, no npm imports. A platform adapter (app/src/engine/telemetry/)
// supplies the ports; the SDK owns queueing, batching, identity assembly,
// truncation and retry.

import type { Clock, IdGenerator } from '../core/clock.ts';
import type { Logger } from '../core/op.ts';
import type { TceResult } from '../core/result.ts';
import type {
  AppWire,
  BatchResponse,
  DeviceWire,
  ErrorKind,
  ForgetResponse,
  PropValue,
  ReportResponse,
  SessionWire,
} from '../core/schema/wire.ts';

/** AsyncStorage keys. Owned by the SDK; the app never reads them directly. */
export const STORAGE_KEYS = {
  /** '1' on, '0' off. Missing = on (telemetry is on by default). */
  enabled: 'phonecando.telemetry.v1',
  installId: 'phonecando.installId.v1',
  /** JSON of the pending queue. */
  queue: 'phonecando.telemetry.queue.v1',
  /** '1' when this phone is marked as one of our test devices. */
  tester: 'phonecando.telemetry.tester.v1',
  /** '1' once the first-launch notice was shown. */
  noticeShown: 'phonecando.telemetry.noticeShown.v1',
} as const;

/** AsyncStorage-compatible. */
export interface StoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * One JSON POST. Resolves with any HTTP status; rejects only on network failure
 * or timeout. `retryAfter` is the raw Retry-After header (seconds or HTTP date)
 * when the response had one; the SDK uses it as the minimum backoff.
 */
export interface NetPort {
  post(url: string, body: string, timeoutMs: number): Promise<{ status: number; text: string; retryAfter?: string | null }>;
}

/**
 * Platform facts. Hashing happens in the adapter (it has native SHA-256).
 * deviceProof = SHA-256(HASH_PEPPER.forget + ANDROID_ID), deviceVerifier =
 * SHA-256(deviceProof); the proof is sent only by forget(), never in batches.
 */
export interface EnvPort {
  identity(): Promise<{
    deviceId: string;
    hwHash: string;
    drmId?: string;
    deviceVerifier: string;
    deviceProof: string;
  }>;
  device(): Promise<Omit<DeviceWire, 'tester'>>;
  app(): AppWire;
}

export interface ClientOptions {
  /** e.g. https://phonecando.tarf.app (no trailing slash). */
  baseUrl: string;
  storage: StoragePort;
  net: NetPort;
  env: EnvPort;
  clock: Clock;
  ids: IdGenerator;
  log?: Logger;
  /** Default 5000. */
  timeoutMs?: number;
  /** Default LIMITS.queueCap; oldest items drop first. */
  queueCap?: number;
}

export interface ErrorInput {
  kind: ErrorKind;
  className: string;
  message: string;
  /** Raw frames; the SDK keeps the top LIMITS.errorFrames and redacts paths. */
  frames: string[];
  ts?: number;
  /** Supply for errors recorded elsewhere (native crashes) so resends stay idempotent. */
  errorId?: string;
  /** Defaults to the current session; null for errors from a previous process. */
  sessionId?: string | null;
  version?: string;
}

export interface TceClient {
  /** Loads flags, install id and the persisted queue. Call once before anything else. */
  init(): Promise<void>;

  isEnabled(): boolean;
  /** Off clears the queue and stops all sending. On resumes. */
  setEnabled(on: boolean): Promise<void>;

  isTester(): boolean;
  setTester(on: boolean): Promise<void>;

  /** Null until init() finished. */
  installId(): string | null;
  /** New random install id; the old one is no longer sent. */
  resetInstallId(): Promise<string>;

  /** Starts a session for this process run and returns its id. */
  startSession(): string;
  /** Merges fields into the current session; sent on the next flush. */
  updateSession(fields: Omit<Partial<SessionWire>, 'sessionId' | 'startedAt'>): void;
  endSession(): void;

  /** Unknown names are dropped (logged in dev). Props are truncated to LIMITS. */
  track(name: string, props?: Record<string, PropValue>): void;
  error(input: ErrorInput): void;

  /**
   * Sends the queue. Null when disabled, nothing to send, backing off, or
   * stopped part-way by turning off, an id reset or forget. Never throws.
   */
  flush(): Promise<TceResult<BatchResponse> | null>;

  /** User-initiated report with recent events. Works only while enabled. */
  report(input: { note?: string; logTail?: string }): Promise<TceResult<ReportResponse>>;

  /**
   * Deletes ALL of this device's server data (every install, by device proof),
   * after stopping and awaiting any in-flight flush so nothing lands afterwards.
   * Then clears the queue, turns telemetry off and rotates the install id.
   * Server `not_found` (nothing stored for this device) is returned as an
   * error with code 'not_found' — still a clean local state; never report it
   * as "deleted".
   */
  forget(): Promise<TceResult<ForgetResponse>>;
}

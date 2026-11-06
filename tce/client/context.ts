// The context one client's concerns share: the ports and settings it was
// built with, resolved once, and all of its mutable state. Each concern
// (init.ts, sessions.ts, flush.ts, ...) is a set of functions over this one
// object, and createClient makes a fresh one per client, so there is still
// no global mutable state.

import type { Clock, IdGenerator } from '../core/clock.ts';
import type { Logger } from '../core/op.ts';
import type { TceResult } from '../core/result.ts';
import { LIMITS } from '../core/schema/limits.ts';
import type { BatchResponse, DeviceWire, EventWire, IdentityWire } from '../core/schema/wire.ts';
import { SILENT } from './log.ts';
import { emptyQueue, type QueueState, type SessionRecord } from './queue.ts';
import type { ClientOptions, EnvPort, NetPort, StoragePort } from './types.ts';

/** Default NetPort timeout. */
export const DEFAULT_TIMEOUT_MS = 5000;

/** One client's ports, resolved settings and mutable state. */
export interface ClientContext {
  readonly storage: StoragePort;
  readonly net: NetPort;
  readonly env: EnvPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly log: Logger;
  /** ClientOptions.baseUrl without trailing slashes. */
  readonly baseUrl: string;
  /** NetPort timeout for every request. */
  readonly timeoutMs: number;
  /** Most items the queue holds (at least 1); the oldest drop first. */
  readonly cap: number;

  /** True once init() has loaded what is stored. */
  ready: boolean;
  initPromise: Promise<void> | null;
  /** On by default; init() reads the stored choice. */
  enabled: boolean;
  tester: boolean;
  install: string | null;
  queue: QueueState;
  /** The current session lives in queue.sessions too while enabled. */
  current: SessionRecord | null;
  /** The stored queue's current session, as init() found it (previousSession()). */
  previousId: string | null;
  /**
   * The last session this process opened, current or since closed: what a
   * write stores as the queue's current session.
   */
  lastOpenedId: string | null;
  /** Last tracked events, sent or not, for report(). */
  recent: EventWire[];
  /**
   * Platform identity, checked once. The proof lives only in proofCache: it
   * is sent by forget() and never put in a batch, a report or a log line.
   */
  identityCache: Omit<IdentityWire, 'installId'> | null;
  proofCache: string | null;
  deviceCache: Omit<DeviceWire, 'tester'> | null;
  /** The running flush, if any; it never rejects. */
  inflight: Promise<TceResult<BatchResponse> | null> | null;
  /** Reports on the wire; forget() waits for them. */
  readonly reports: Set<Promise<unknown>>;
  /**
   * Bumped whenever what a running flush planned must not be sent any more:
   * telemetry turned off, a new install id, forget starting. A flush stops
   * before its next batch when it sees a different value.
   */
  epoch: number;
  /** While forget() or resetInstallId() runs, flush() sends nothing. */
  forgetting: boolean;
  resetting: number;
  /** Consecutive retryable send failures. */
  failures: number;
  /** No batch is sent before this time (epoch ms). */
  retryAt: number;
  capWarned: boolean;
  persistTimer: ReturnType<typeof setTimeout> | null;
  /** A write was asked for before init() finished. */
  persistWanted: boolean;
  /** The last queued write; the next one runs after it. */
  writeChain: Promise<void>;
}

/** True for a finite number. */
export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** A fresh context over the given ports: settings resolved, nothing loaded yet (init.ts does that). */
export function createContext(opts: ClientOptions): ClientContext {
  const { storage, net, env, clock, ids } = opts;
  return {
    storage,
    net,
    env,
    clock,
    ids,
    log: opts.log ?? SILENT,
    baseUrl: opts.baseUrl.replace(/\/+$/, ''),
    timeoutMs: isNum(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_TIMEOUT_MS,
    cap: Math.max(1, Math.floor(isNum(opts.queueCap) ? opts.queueCap : LIMITS.queueCap)),

    ready: false,
    initPromise: null,
    enabled: true,
    tester: false,
    install: null,
    queue: emptyQueue(),
    current: null,
    previousId: null,
    lastOpenedId: null,
    recent: [],
    identityCache: null,
    proofCache: null,
    deviceCache: null,
    inflight: null,
    reports: new Set<Promise<unknown>>(),
    epoch: 0,
    forgetting: false,
    resetting: 0,
    failures: 0,
    retryAt: 0,
    capWarned: false,
    persistTimer: null,
    persistWanted: false,
    writeChain: Promise.resolve(),
  };
}

/** A new UUID from the IdGenerator, lowercased. */
export function newUuid(c: ClientContext): string {
  return c.ids.uuid().toLowerCase();
}

/** The current session's id, or null when there is none. */
export function currentId(c: ClientContext): string | null {
  return c.current?.wire.sessionId ?? null;
}

/** The clock in whole epoch milliseconds: the server takes whole epoch milliseconds only. */
export function now(c: ClientContext): number {
  return Math.round(c.clock.now());
}

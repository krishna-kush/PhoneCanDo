// In-memory doubles for the SDK's ports, used by the client tests. Pure, so
// they type-check under the client's own tsconfig; nothing in the SDK
// imports this file.

import type { Clock, IdGenerator } from '../core/clock.ts';
import type { Logger } from '../core/op.ts';
import type { AppWire, DeviceWire } from '../core/schema/wire.ts';
import type { EnvPort, NetPort, StoragePort } from './types.ts';

/** Storage over a Map, with switchable read/write failures. */
export class FakeStorage implements StoragePort {
  readonly data = new Map<string, string>();
  failReads = false;
  failWrites = false;
  writes = 0;

  async getItem(key: string): Promise<string | null> {
    if (this.failReads) throw new Error('storage read failed');
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error('storage write failed');
    this.writes++;
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.failWrites) throw new Error('storage write failed');
    this.writes++;
    this.data.delete(key);
  }
}

/** One recorded POST. */
export interface SentRequest {
  url: string;
  path: string;
  body: string;
  json: any;
  timeoutMs: number;
}

/** A scripted reply: a status, body and optional Retry-After header, or a thrown network error. */
export type Reply = { status: number; body?: unknown; retryAfter?: string } | { fail: string };

/**
 * What the TCE answers a well-formed request on `path` with: 200 and the op's
 * response for exactly what was sent.
 */
export function serverReply(path: string, req: any): Reply {
  if (path === '/v1/batch') {
    const accepted = { sessions: req.sessions?.length ?? 0, events: req.events?.length ?? 0, errors: req.errors?.length ?? 0 };
    return { status: 200, body: { serverTime: 1_750_000_000_000, accepted, droppedEvents: 0 } };
  }
  if (path === '/v1/report') return { status: 200, body: { reportId: req.reportId, serverTime: 1_750_000_000_000 } };
  if (path === '/v1/forget') return { status: 200, body: { deleted: {} } };
  return { status: 404, body: { error: { code: 'not_found', message: `no route for ${path}` } } };
}

/** Net port that records requests and answers from a script (default: serverReply). */
export class FakeNet implements NetPort {
  readonly sent: SentRequest[] = [];
  private readonly script: Reply[] = [];
  /** Answer once the script is used up; null answers like the server (serverReply). */
  fallback: Reply | null = null;
  /** When set, post() waits for this promise before answering. */
  gate: Promise<void> | null = null;

  /** Queues replies for the next posts, in order. */
  reply(...replies: Reply[]): this {
    this.script.push(...replies);
    return this;
  }

  /** Requests whose path matches. */
  to(path: string): SentRequest[] {
    return this.sent.filter((r) => r.path === path);
  }

  async post(url: string, body: string, timeoutMs: number): Promise<{ status: number; text: string; retryAfter?: string | null }> {
    const path = new URL(url).pathname;
    const json = JSON.parse(body);
    this.sent.push({ url, path, body, json, timeoutMs });
    if (this.gate) await this.gate;
    const r = this.script.shift() ?? this.fallback ?? serverReply(path, json);
    if ('fail' in r) throw new Error(r.fail);
    const text = r.body === undefined ? '' : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return r.retryAfter === undefined ? { status: r.status, text } : { status: r.status, text, retryAfter: r.retryAfter };
  }
}

/** Clock that only moves when told. */
export class FakeClock implements Clock {
  t: number;
  constructor(start = 1_750_000_000_000) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

/** Deterministic, valid lowercase v4 UUIDs. */
export class FakeIds implements IdGenerator {
  private n = 0;
  uuid(): string {
    this.n++;
    return `00000000-0000-4000-8000-${this.n.toString(16).padStart(12, '0')}`;
  }
}

/** Fixed platform facts with valid 64-hex ids (the proof is not a real hash; tests needing one set it). */
export class FakeEnv implements EnvPort {
  deviceId = 'a'.repeat(64);
  hwHash = 'b'.repeat(64);
  deviceVerifier = '9'.repeat(64);
  deviceProof = '7'.repeat(64);
  drmId: string | undefined = undefined;
  identityCalls = 0;
  failIdentity = false;
  appWire: AppWire = { version: '0.1.3', versionCode: 13, channel: 'full' };
  deviceWire: Omit<DeviceWire, 'tester'> = {
    manufacturer: 'Google',
    model: 'Pixel 9',
    sdkInt: 36,
    abi: 'arm64-v8a',
    ramGb: 12,
    locale: 'en-IN',
    installSource: null,
  };

  async identity(): Promise<Awaited<ReturnType<EnvPort['identity']>>> {
    this.identityCalls++;
    if (this.failIdentity) throw new Error('identity unavailable');
    const base = {
      deviceId: this.deviceId,
      hwHash: this.hwHash,
      deviceVerifier: this.deviceVerifier,
      deviceProof: this.deviceProof,
    };
    return this.drmId ? { ...base, drmId: this.drmId } : base;
  }

  async device(): Promise<Omit<DeviceWire, 'tester'>> {
    return this.deviceWire;
  }

  app(): AppWire {
    return this.appWire;
  }
}

/** One captured log line. */
export interface LogLine {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

/** Logger that keeps every line. */
export class FakeLog implements Logger {
  readonly lines: LogLine[] = [];
  info(message: string, data?: Record<string, unknown>): void {
    this.lines.push({ level: 'info', message, data });
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.lines.push({ level: 'warn', message, data });
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.lines.push({ level: 'error', message, data });
  }
  has(level: LogLine['level'], fragment: string): boolean {
    return this.lines.some((l) => l.level === level && l.message.includes(fragment));
  }
}

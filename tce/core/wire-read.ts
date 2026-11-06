// Readers for the wire shapes in schema/wire.ts, shared by the batch and
// report ops, plus the sanitizers that turn free-form props and counters into
// bounded stored JSON. Readers check shape and truncate; they never decide
// what is kept (unknown event names, bad prop values): the ops do that.

import { UUID } from './identity.ts';
import { redactText } from './redact.ts';
import { LIMITS, SCHEMA_VERSION } from './schema/limits.ts';
import type { AppWire, Channel, DeviceWire, ErrorKind, PropValue } from './schema/wire.ts';
import { INT32_MAX, isPlainObject, truncate, truncateTail, utf8Length, type JsonObject, type Reader } from './validate.ts';

/** App channels the server accepts. */
export const CHANNELS: readonly Channel[] = ['full', 'lite', 'play'];
/** Error kinds the server accepts. */
export const ERROR_KINDS: readonly ErrorKind[] = ['js', 'native', 'engine'];

// Event names are at most ~60 characters (schema/events.ts); a longer string
// is cut here and then fails isEventName, so the cut never makes a name valid.
const EVENT_NAME_READ_CAP = 128;
// Counter keys are code identifiers (`tool.mobile_click`); anything else could carry free text.
const COUNTER_KEY = /^[A-Za-z0-9_.:-]+$/;

/** One session from a batch, with absent optional fields as null. */
export interface ParsedSession {
  sessionId: string;
  startedAt: number;
  /** The build the session ran, stamped at its start; null when the client did not send it. */
  version: string | null;
  versionCode: number | null;
  channel: Channel | null;
  endedAt: number | null;
  bootMs: number | null;
  engineOk: boolean | null;
  engineExitCode: number | null;
  /** Redacted, at most LIMITS.stderrTail code points (the end is kept). */
  engineStderrTail: string | null;
  lowMemoryTrims: number | null;
  batteryOptIgnored: boolean | null;
  fgServiceOk: boolean | null;
  a11yOn: boolean | null;
  /** Shape-checked only; sanitizeCounters() bounds it. */
  counters: JsonObject | null;
}

/** One event; the name is not yet checked against the vocabulary. */
export interface ParsedEvent {
  sessionId: string;
  seq: number;
  ts: number;
  name: string;
  /** Shape-checked only; sanitizeProps() bounds it. */
  props: JsonObject | null;
}

/** One error, redacted and truncated to LIMITS. */
export interface ParsedError {
  errorId: string;
  sessionId: string | null;
  seq: number | null;
  ts: number;
  kind: ErrorKind;
  className: string;
  message: string;
  /** At most LIMITS.errorFrames frames. */
  frames: string[];
  version: string | null;
}

/** The request object, checked for `schema === SCHEMA_VERSION` (else `unsupported`). */
export function readEnvelope(r: Reader, body: unknown): JsonObject {
  if (!isPlainObject(body)) {
    r.fail('bad_request', 'body must be a JSON object');
    return {};
  }
  if (body.schema !== SCHEMA_VERSION) r.fail('unsupported', `schema must be ${SCHEMA_VERSION}`, 'schema');
  return body;
}

/** A string with paths and secrets redacted, truncated to `max` code points from the start. */
export function readText(r: Reader, v: unknown, field: string, max: number): string {
  // Why redact before truncating: a cut could split a path or key so that the rest no longer matches.
  return truncate(redactText(r.string(v, field, Number.MAX_SAFE_INTEGER)), max);
}

/** An optional redacted string truncated to `max`. */
export function readOptionalText(r: Reader, v: unknown, field: string, max: number): string | null {
  return v === undefined || v === null ? null : readText(r, v, field, max);
}

/** An optional redacted log tail: the last `max` code points are kept. */
export function readOptionalTail(r: Reader, v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  return truncateTail(redactText(r.string(v, field, Number.MAX_SAFE_INTEGER)), max);
}

/** Read every item of a capped list (over the cap is `too_large`), stopping at the first failure. */
export function readEach<T>(
  r: Reader,
  v: unknown,
  field: string,
  cap: number,
  item: (r: Reader, v: unknown, field: string) => T,
): T[] {
  const out: T[] = [];
  const list = r.list(v, field, cap);
  for (let i = 0; i < list.length && !r.error; i++) out.push(item(r, list[i], `${field}.${i}`));
  return out;
}

/** DeviceWire with strings truncated to LIMITS.shortText and RAM rounded to whole GB. */
export function readDevice(r: Reader, v: unknown, field: string): DeviceWire {
  const o = r.object(v, field);
  return {
    manufacturer: r.string(o.manufacturer, `${field}.manufacturer`, LIMITS.shortText),
    model: r.string(o.model, `${field}.model`, LIMITS.shortText),
    sdkInt: r.int(o.sdkInt, `${field}.sdkInt`, 1, 1000),
    abi: r.string(o.abi, `${field}.abi`, LIMITS.shortText),
    ramGb: Math.round(r.number(o.ramGb, `${field}.ramGb`, 0, 4096)),
    locale: r.string(o.locale, `${field}.locale`, LIMITS.shortText),
    installSource: r.optionalString(o.installSource, `${field}.installSource`, LIMITS.shortText),
    tester: r.bool(o.tester, `${field}.tester`),
  };
}

/** AppWire with the version truncated to LIMITS.shortText. */
export function readApp(r: Reader, v: unknown, field: string): AppWire {
  const o = r.object(v, field);
  return {
    version: r.string(o.version, `${field}.version`, LIMITS.shortText),
    versionCode: r.int(o.versionCode, `${field}.versionCode`, 0, INT32_MAX),
    channel: r.oneOf(o.channel, `${field}.channel`, CHANNELS),
  };
}

/** One SessionWire; its own version, versionCode and channel are optional. */
export function readSession(r: Reader, v: unknown, field: string): ParsedSession {
  const o = r.object(v, field);
  return {
    sessionId: r.match(o.sessionId, `${field}.sessionId`, UUID, 'a lowercase UUID'),
    startedAt: r.epochMs(o.startedAt, `${field}.startedAt`),
    version: r.optionalString(o.version, `${field}.version`, LIMITS.shortText),
    versionCode: r.optionalInt(o.versionCode, `${field}.versionCode`, 0, INT32_MAX),
    channel: r.optionalOneOf(o.channel, `${field}.channel`, CHANNELS),
    endedAt: r.optionalEpochMs(o.endedAt, `${field}.endedAt`),
    bootMs: r.optionalInt(o.bootMs, `${field}.bootMs`, 0, INT32_MAX),
    engineOk: r.optionalBool(o.engineOk, `${field}.engineOk`),
    engineExitCode: r.optionalInt(o.engineExitCode, `${field}.engineExitCode`, -INT32_MAX - 1, INT32_MAX),
    engineStderrTail: readOptionalTail(r, o.engineStderrTail, `${field}.engineStderrTail`, LIMITS.stderrTail),
    lowMemoryTrims: r.optionalInt(o.lowMemoryTrims, `${field}.lowMemoryTrims`, 0, INT32_MAX),
    batteryOptIgnored: r.optionalBool(o.batteryOptIgnored, `${field}.batteryOptIgnored`),
    fgServiceOk: r.optionalBool(o.fgServiceOk, `${field}.fgServiceOk`),
    a11yOn: r.optionalBool(o.a11yOn, `${field}.a11yOn`),
    counters: r.optionalObject(o.counters, `${field}.counters`),
  };
}

/** One EventWire. */
export function readEvent(r: Reader, v: unknown, field: string): ParsedEvent {
  const o = r.object(v, field);
  return {
    sessionId: r.match(o.sessionId, `${field}.sessionId`, UUID, 'a lowercase UUID'),
    seq: r.int(o.seq, `${field}.seq`, 0, INT32_MAX),
    ts: r.epochMs(o.ts, `${field}.ts`),
    name: r.string(o.name, `${field}.name`, EVENT_NAME_READ_CAP),
    props: r.optionalObject(o.props, `${field}.props`),
  };
}

/** One ErrorWire: class, message and the top frames are redacted and truncated. */
export function readError(r: Reader, v: unknown, field: string): ParsedError {
  const o = r.object(v, field);
  const rawFrames = r.list(o.frames, `${field}.frames`, Number.MAX_SAFE_INTEGER);
  const frames: string[] = [];
  for (let i = 0; i < rawFrames.length && i < LIMITS.errorFrames; i++) {
    frames.push(readText(r, rawFrames[i], `${field}.frames.${i}`, LIMITS.errorFrameLength));
  }
  return {
    errorId: r.match(o.errorId, `${field}.errorId`, UUID, 'a lowercase UUID'),
    sessionId: r.optionalMatch(o.sessionId, `${field}.sessionId`, UUID, 'a lowercase UUID'),
    seq: r.optionalInt(o.seq, `${field}.seq`, 0, INT32_MAX),
    ts: r.epochMs(o.ts, `${field}.ts`),
    kind: r.oneOf(o.kind, `${field}.kind`, ERROR_KINDS),
    className: readText(r, o.className, `${field}.className`, LIMITS.errorClass),
    message: readText(r, o.message, `${field}.message`, LIMITS.errorMessage),
    frames,
    version: r.optionalString(o.version, `${field}.version`, LIMITS.shortText),
  };
}

function longerThan(s: string, max: number): boolean {
  return s.length > max && Array.from(s).length > max;
}

/**
 * Bounded props: at most LIMITS.propsKeys keys of at most propKeyLength
 * characters; strings cut to propStringLength; non-finite numbers and
 * non-primitive values dropped; then keys dropped from the end until the JSON
 * is at most propsBytes. Null when nothing survives.
 */
export function sanitizePropsObject(props: JsonObject | null): Record<string, PropValue> | null {
  if (!props) return null;
  const kept: [string, PropValue][] = [];
  for (const [k, v] of Object.entries(props)) {
    if (kept.length === LIMITS.propsKeys) break;
    if (k === '' || longerThan(k, LIMITS.propKeyLength)) continue;
    if (typeof v === 'string') kept.push([k, truncate(v, LIMITS.propStringLength)]);
    else if (typeof v === 'number' && Number.isFinite(v)) kept.push([k, v]);
    else if (typeof v === 'boolean') kept.push([k, v]);
  }
  while (kept.length > 0) {
    // Object.fromEntries defines own properties, so a '__proto__' key stays data.
    const obj = Object.fromEntries(kept);
    if (utf8Length(JSON.stringify(obj)) <= LIMITS.propsBytes) return obj;
    kept.pop();
  }
  return null;
}

/** sanitizePropsObject() as the stored JSON string, or null. */
export function sanitizeProps(props: JsonObject | null): string | null {
  const obj = sanitizePropsObject(props);
  return obj ? JSON.stringify(obj) : null;
}

/**
 * Bounded counters JSON: at most LIMITS.counterKeys identifier-like keys
 * (≤ LIMITS.shortText characters) with non-negative safe-integer values.
 * Null when nothing survives, so a merge keeps the previous counters.
 */
export function sanitizeCounters(counters: JsonObject | null): string | null {
  if (!counters) return null;
  const kept: [string, number][] = [];
  for (const [k, v] of Object.entries(counters)) {
    if (kept.length === LIMITS.counterKeys) break;
    if (k.length > LIMITS.shortText || !COUNTER_KEY.test(k)) continue;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) continue;
    kept.push([k, v]);
  }
  return kept.length > 0 ? JSON.stringify(Object.fromEntries(kept)) : null;
}

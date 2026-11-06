// Client-side truncation and redaction. Everything the SDK sends passes
// through here first, so a normal app never hits a server-side cap and no
// device path or credential leaves the device. Pure functions, no state.

import { redactText } from '../core/redact.ts';
import { LIMITS } from '../core/schema/limits.ts';
import type { AppWire, Channel, DeviceWire, PropValue, SessionWire } from '../core/schema/wire.ts';
import { EPOCH_MS_MAX, EPOCH_MS_MIN, INT32_MAX } from '../core/validate.ts';

/**
 * Replaces device paths with `<path>` (a frame's `:line:col` stays) and
 * credential values with `<secret>`. Why the server's own rules
 * (core/redact.ts) and not a copy: the phone must redact at least what the
 * server would, and one implementation cannot drift from itself.
 */
export function redact(text: string): string {
  return redactText(text);
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** First `max` UTF-16 units, never ending on half a surrogate pair. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = text.slice(0, Math.max(0, max));
  if (out.length > 0 && isHighSurrogate(out.charCodeAt(out.length - 1))) out = out.slice(0, -1);
  return out;
}

/** Last `max` UTF-16 units, never starting on half a surrogate pair. */
export function tail(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 0) return '';
  let out = text.slice(text.length - max);
  if (out.length > 0 && isLowSurrogate(out.charCodeAt(0))) out = out.slice(1);
  return out;
}

/**
 * UTF-8 byte length of a string. Exact for JSON.stringify output (which
 * escapes lone surrogates); TextEncoder is not assumed to exist.
 */
export function utf8Length(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (isHighSurrogate(c) && i + 1 < text.length && isLowSurrogate(text.charCodeAt(i + 1))) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** UTF-8 size of a value's JSON. */
export function jsonBytes(value: unknown): number {
  return utf8Length(JSON.stringify(value));
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** True for an integer epoch-ms time the server accepts (years 2000 to 2200). */
export function isEpochMs(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= EPOCH_MS_MIN && v < EPOCH_MS_MAX;
}

// Counter keys are code identifiers on the server; other characters become `_`.
const COUNTER_KEY_BAD = /[^A-Za-z0-9_.:-]/g;

/** A counter key the server keeps: [A-Za-z0-9_.:-], at most LIMITS.shortText chars. '' when nothing is left. */
export function counterKey(raw: string): string {
  return clip(raw.replace(COUNTER_KEY_BAD, '_'), LIMITS.shortText);
}

/**
 * Event props cut to LIMITS: at most propsKeys keys of propKeyLength chars,
 * strings of propStringLength chars (paths and secrets redacted), finite numbers and
 * booleans only, and a JSON size of at most propsBytes. Returns undefined
 * when nothing survives.
 */
export function sanitizeProps(props: unknown): Record<string, PropValue> | undefined {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return undefined;
  const out: Record<string, PropValue> = {};
  let kept = 0;
  for (const [rawKey, raw] of Object.entries(props as Record<string, unknown>)) {
    if (kept >= LIMITS.propsKeys) break;
    const key = clip(rawKey, LIMITS.propKeyLength);
    // `__proto__` would set the prototype instead of a key.
    if (!key || key === '__proto__' || Object.prototype.hasOwnProperty.call(out, key)) continue;
    let value: PropValue;
    if (typeof raw === 'string') value = clip(redact(raw), LIMITS.propStringLength);
    else if (finite(raw)) value = raw;
    else if (typeof raw === 'boolean') value = raw;
    else continue;
    out[key] = value;
    let over = jsonBytes(out) - LIMITS.propsBytes;
    // Shorten a string that tips the size over; drop anything else that does.
    // Each removed char frees at least one byte, so this terminates.
    while (over > 0) {
      const current = out[key];
      if (typeof current === 'string' && current.length > over) {
        out[key] = clip(current, current.length - over);
        over = jsonBytes(out) - LIMITS.propsBytes;
      } else {
        delete out[key];
        over = 0;
      }
    }
    if (Object.prototype.hasOwnProperty.call(out, key)) kept++;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Key-wise merge of counters: an incoming key replaces the stored value.
 * Keys are made server-safe (counterKey), values rounded to non-negative safe
 * integers (others dropped), and at most LIMITS.counterKeys keys are kept
 * (existing keys keep their place).
 */
export function mergeCounters(
  existing: Record<string, number> | undefined,
  incoming: unknown,
): Record<string, number> | undefined {
  const out: Record<string, number> = { ...(existing ?? {}) };
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
    for (const [rawKey, raw] of Object.entries(incoming as Record<string, unknown>)) {
      const key = counterKey(rawKey);
      if (!key || key === '__proto__' || !finite(raw)) continue;
      const value = Math.round(raw);
      if (value < 0 || !Number.isSafeInteger(value)) continue;
      const known = Object.prototype.hasOwnProperty.call(out, key);
      if (!known && Object.keys(out).length >= LIMITS.counterKeys) continue;
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Session fields an app may update (everything but the id and start time). */
export type SessionFields = Omit<Partial<SessionWire>, 'sessionId' | 'startedAt'>;

// Whole numbers in the server's INTEGER range; anything else is left out.
function nonNegInt(v: unknown): number | undefined {
  if (!finite(v) || v < 0) return undefined;
  const n = Math.round(v);
  return n <= INT32_MAX ? n : undefined;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return finite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

/**
 * Cleans an updateSession() payload: numbers whole and in the server's
 * ranges (endedAt a plausible epoch-ms time), booleans real booleans. A value
 * the server would reject is left out rather than sent. Counters are not
 * handled here (mergeCounters). `engineStderrTail` is always dropped: raw
 * engine output can hold prompt text, so it never rides in an automatic
 * session upsert; the app attaches it only to a user report (logTail).
 */
export function sanitizeSessionFields(fields: SessionFields): Omit<SessionFields, 'counters'> {
  const out: Omit<SessionFields, 'counters'> = {};
  const endedAt = finite(fields.endedAt) ? Math.round(fields.endedAt) : undefined;
  if (isEpochMs(endedAt)) out.endedAt = endedAt;
  const bootMs = nonNegInt(fields.bootMs);
  if (bootMs !== undefined) out.bootMs = bootMs;
  if (finite(fields.engineExitCode)) {
    const code = Math.trunc(fields.engineExitCode);
    if (code >= -INT32_MAX - 1 && code <= INT32_MAX) out.engineExitCode = code;
  }
  const trims = nonNegInt(fields.lowMemoryTrims);
  if (trims !== undefined) out.lowMemoryTrims = trims;
  if (typeof fields.engineOk === 'boolean') out.engineOk = fields.engineOk;
  if (typeof fields.batteryOptIgnored === 'boolean') out.batteryOptIgnored = fields.batteryOptIgnored;
  if (typeof fields.fgServiceOk === 'boolean') out.fgServiceOk = fields.fgServiceOk;
  if (typeof fields.a11yOn === 'boolean') out.a11yOn = fields.a11yOn;
  return out;
}

/** Error class name and message, redacted then cut to LIMITS. */
export function sanitizeErrorText(className: string, message: string): { className: string; message: string } {
  return {
    className: clip(redact(String(className ?? '')).trim(), LIMITS.errorClass) || 'Error',
    message: clip(redact(String(message ?? '')), LIMITS.errorMessage),
  };
}

/** Top LIMITS.errorFrames non-empty frames, each redacted and cut to LIMITS.errorFrameLength. */
export function sanitizeFrames(frames: unknown): string[] {
  if (!Array.isArray(frames)) return [];
  const out: string[] = [];
  for (const f of frames) {
    if (out.length >= LIMITS.errorFrames) break;
    if (typeof f !== 'string') continue;
    const line = clip(redact(f).trim(), LIMITS.errorFrameLength);
    if (line) out.push(line);
  }
  return out;
}

/** Short text field (version, model, locale ...) cut to LIMITS.shortText. */
export function shortText(value: unknown, fallback = 'unknown'): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return s ? clip(s, LIMITS.shortText) : fallback;
}

const CHANNELS: readonly Channel[] = ['full', 'lite', 'play'];

/**
 * Device facts cut to LIMITS and clamped into the server's ranges (sdkInt
 * 1..1000, ramGb 0..4096), with the tester flag added.
 */
export function sanitizeDevice(device: Omit<DeviceWire, 'tester'>, tester: boolean): DeviceWire {
  return {
    manufacturer: shortText(device.manufacturer),
    model: shortText(device.model),
    sdkInt: clampInt(device.sdkInt, 1, 1000, 1),
    abi: shortText(device.abi),
    ramGb: clampInt(device.ramGb, 0, 4096, 0),
    locale: shortText(device.locale, 'und'),
    installSource: typeof device.installSource === 'string' && device.installSource.trim()
      ? clip(device.installSource.trim(), LIMITS.shortText)
      : null,
    tester,
  };
}

/** App facts cut to LIMITS; an unknown channel reads as full. */
export function sanitizeApp(app: AppWire): AppWire {
  return {
    version: shortText(app.version, '0.0.0'),
    versionCode: clampInt(app.versionCode, 0, INT32_MAX, 0),
    channel: CHANNELS.includes(app.channel) ? app.channel : 'full',
  };
}

/** Report note: trimmed, paths and secrets redacted, cut to LIMITS.reportNote. Undefined when empty. */
export function sanitizeNote(note: unknown): string | undefined {
  if (typeof note !== 'string') return undefined;
  const s = clip(redact(note.trim()), LIMITS.reportNote);
  return s ? s : undefined;
}

/**
 * Log tail: paths and secrets redacted over the whole text first (so a cut
 * can never split one and leak its end), then the last LIMITS.logTail chars.
 */
export function sanitizeLogTail(text: unknown): string | undefined {
  if (typeof text !== 'string' || !text) return undefined;
  const s = tail(redact(text), LIMITS.logTail);
  return s ? s : undefined;
}

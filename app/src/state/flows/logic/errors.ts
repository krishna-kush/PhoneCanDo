// Linux error codes, as the native side reports them: a rejection's `code`
// (LinuxError from engine/linux/native.ts, LinuxJobError from a flow), and
// `errorCode` on a failed record or progress event. Pure: the flows, the
// store and the screens read a code out of whatever they got through here.
import type { LinuxErrorCode } from '../../../engine/linux/types';

export type { LinuxErrorCode };

/** What went wrong: the stable code and the native line (for logs and `internal`). */
export type JobFailure = { code: LinuxErrorCode; message: string };

// A Record, so a new code in types.ts fails the build here until it is listed.
const KNOWN: Record<LinuxErrorCode, true> = {
  unsafe_entry: true,
  too_large: true,
  invalid_ref: true,
  no_space: true,
  digest_mismatch: true,
  network: true,
  rate_limited: true,
  not_found: true,
  no_arm64: true,
  unsupported_layer: true,
  unsupported_manifest: true,
  no_shell: true,
  corrupt: true,
  cancelled: true,
  linux_unavailable: true,
  env_in_use: true,
  busy: true,
  command_failed: true,
  timed_out: true,
  internal: true,
};

export function isLinuxErrorCode(value: unknown): value is LinuxErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(KNOWN, value);
}

// A native line may lead with its code (`no_space: 12 MB free`).
const LEADING_CODE = /^([a-z0-9_]+):\s*/;

/** A record's or event's failure; null when it carries none. The code is `errorCode`, else the
    line's leading code, else `internal`; the message drops a leading code. */
export function failureOf(
  error: string | null | undefined,
  errorCode: string | null | undefined,
): JobFailure | null {
  if (!error && !errorCode) return null;
  const line = (error ?? '').trim();
  const lead = LEADING_CODE.exec(line);
  const leadCode = lead && isLinuxErrorCode(lead[1]) ? lead[1] : null;
  const code = isLinuxErrorCode(errorCode) ? errorCode : (leadCode ?? 'internal');
  return { code, message: lead && leadCode ? line.slice(lead[0].length) : line };
}

/** Any rejection as a code: its `code` field, else its message's leading code, else `internal`. */
export function linuxErrorCode(e: unknown): LinuxErrorCode {
  return failureOfError(e).code;
}

/** Any rejection as a failure: its code and its message. */
export function failureOfError(e: unknown): JobFailure {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  const raw = (e as { code?: unknown } | null)?.code;
  return failureOf(message || null, typeof raw === 'string' ? raw : null) ?? { code: 'internal', message: '' };
}

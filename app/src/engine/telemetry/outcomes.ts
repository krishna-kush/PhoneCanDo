// What a user action reports back, in plain words: the outcome type, the
// text for each kind of failure, and the Delete my data summary built from
// the server's counts. Pure.
import type { TceError } from '../../../../tce/core/result.ts';
import type { ForgetResponse } from '../../../../tce/core/schema/wire.ts';

/** Result of a user action, with the text to show. */
export type TelemetryOutcome = { ok: true; message: string } | { ok: false; message: string };

export function failure(error: TceError): TelemetryOutcome {
  if (error.message.includes('debug build')) {
    return { ok: false, message: 'Debug build: turn on "Send to local dev host" first.' };
  }
  if (error.code === 'unavailable') return { ok: false, message: 'Could not reach the server. Try again later.' };
  if (error.code === 'internal') return { ok: false, message: 'The server had a problem. Try again later.' };
  return { ok: false, message: `The server refused it (${error.code}).` };
}

export const UNAVAILABLE: TelemetryOutcome = { ok: false, message: 'Usage stats are not available in this build.' };

/** Shown when the server held nothing for this phone; never call that a deletion. */
export const NOTHING_STORED_MESSAGE = 'Nothing was stored on the server for this phone. Sharing is off.';

const TABLE_NAMES: ReadonlyArray<readonly [string, string, string]> = [
  ['devices', 'device record', 'device records'],
  ['installs', 'install', 'installs'],
  ['sessions', 'session', 'sessions'],
  ['events', 'event', 'events'],
  ['errors', 'error', 'errors'],
  ['reports', 'report', 'reports'],
];

/** "Deleted from the server: 1 device record, 2 installs, … Sharing is off." from forget's counts. */
export function deletedMessage(res: ForgetResponse): string {
  const counts = { ...res.deleted };
  const parts: string[] = [];
  for (const [key, one, many] of TABLE_NAMES) {
    const n = counts[key];
    delete counts[key];
    if (typeof n === 'number' && n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  }
  for (const [key, n] of Object.entries(counts)) if (n > 0) parts.push(`${n} ${key}`);
  if (parts.length === 0) return "This phone's usage data was deleted from the server. Sharing is off.";
  return `Deleted from the server: ${parts.join(', ')}. Sharing is off.`;
}

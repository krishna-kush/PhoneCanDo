// Logging for the client SDK: the silent default logger and how a caught
// value is named in a log line or an error message.

import type { Logger } from '../core/op.ts';

/** The logger used when ClientOptions.log is left out: drops every line. */
export const SILENT: Logger = { info() {}, warn() {}, error() {} };

/** A caught value as text: an Error's message (or its name), anything else stringified. */
export function describe(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  return String(e);
}

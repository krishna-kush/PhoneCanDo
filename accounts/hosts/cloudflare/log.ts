// JSON log lines for Workers Logs. Callers never pass tokens, nonces, emails
// or Google account numbers (core/ports.ts Logger).

import type { Logger } from '../../core/ports.ts';

/** A logger that writes one JSON line per call with `base` on every line. */
export function jsonLogger(base: Record<string, unknown>): Logger {
  const line = (level: string, message: string, data?: Record<string, unknown>): string =>
    JSON.stringify({ level, message, area: 'accounts', ...base, ...data });
  return {
    info: (m, d) => console.log(line('info', m, d)),
    warn: (m, d) => console.warn(line('warn', m, d)),
    error: (m, d) => console.error(line('error', m, d)),
  };
}

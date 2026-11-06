// The adapter's logger: every line tagged [phonecando-telemetry] for logcat,
// with its data as JSON when it serialises. Errors go to console.warn, since
// console.error would raise LogBox in dev.
import type { Logger } from '../../../../tce/core/op.ts';

function fmt(message: string, data?: Record<string, unknown>): string {
  if (!data) return `[phonecando-telemetry] ${message}`;
  try {
    return `[phonecando-telemetry] ${message} ${JSON.stringify(data)}`;
  } catch {
    return `[phonecando-telemetry] ${message}`;
  }
}

export const log: Logger = {
  info: (m, d) => console.log(fmt(m, d)),
  warn: (m, d) => console.warn(fmt(m, d)),
  error: (m, d) => console.warn(fmt(m, d)), // console.error would raise LogBox in dev
};

// The line over a model's server log: live while its server loads or
// runs, otherwise when its last run wrote it. Pure (zero RN imports).
import { logWrittenLine } from '../../env/logic/installText';

/** Where the model's server is: loading the weights, answering, or not running. */
export type ServerState = 'loading' | 'loaded' | 'stopped';

export const SERVER_LOG_NONE = 'No server log yet: the server starts with the first agent set to this model.';

/** "Loading: new lines show as its server writes them", or "Last run · Written 5 min ago at 14:03"; either notes a left-out start. */
export function serverLogLine(log: { modifiedAt: number; cut: boolean }, server: ServerState, now: number): string {
  if (server === 'stopped') return `Last run · ${logWrittenLine(log.modifiedAt, log.cut, now)}`;
  const live = `${server === 'loading' ? 'Loading' : 'Loaded'}: new lines show as its server writes them`;
  return log.cut ? `${live} · its start is left out` : live;
}

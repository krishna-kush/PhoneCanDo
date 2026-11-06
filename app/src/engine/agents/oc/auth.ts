// opencode v2 serve is auth-first: REST, SSE and the TUI all send HTTP Basic
// with the server password under the fixed user `opencode` (an upstream
// name; never rename it).
import type { EngineConn } from '../types';

export function authHeader(conn: EngineConn): Record<string, string> {
  try {
    const pw = conn.password();
    if (!pw) return {};
    // btoa exists in Hermes (see terminal/keys.ts toB64).
    return { Authorization: `Basic ${btoa(`opencode:${pw}`)}` };
  } catch {
    return {};
  }
}

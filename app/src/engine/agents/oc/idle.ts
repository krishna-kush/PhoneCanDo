// opencode is idle when no session moved in the last minute: live
// generation bumps a session's `time.updated`.
import type { EngineConn } from '../types';
import { listSessions } from './client';

const RECENT_MS = 60_000;

export async function isIdle(conn: EngineConn): Promise<boolean> {
  const sessions = await listSessions(conn);
  return !sessions.some((s) => (s.time?.updated ?? 0) > Date.now() - RECENT_MS);
}

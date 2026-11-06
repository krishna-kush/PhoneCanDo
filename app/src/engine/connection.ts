// Reaching the running engine: its loopback address and password, and a
// wait for a fresh start to answer. Kind-neutral: what a request looks like
// is the agent kind's business (agents/).
import type { AgentKind, EngineConn } from './agents/types';
import { engineBaseUrl, getServePassword } from './runner';

export function engineConn(port: string): EngineConn {
  return { baseUrl: engineBaseUrl(port), password: getServePassword };
}

// Blocks until the engine answers (fresh start takes a few seconds) so a
// first open succeeds instead of attaching to a half-born serve.
export async function waitForEngine(kind: AgentKind, conn: EngineConn, timeoutMs = 9000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await kind.listSessions(conn);
      return true;
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

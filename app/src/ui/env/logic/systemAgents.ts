// How many agents run on a system, as its line on the Systems page says
// it. Pure (zero RN imports): scripts/vectors/test_system_looks.js checks it.
import { agentCountOf, type EnvRow } from './sections.ts';

/** "no agents", "1 agent", "3 agents · 1 setting up" (machines not ready yet). */
export function systemAgentsLine(rows: readonly EnvRow<{ state: string }, unknown>[]): string {
  const agents = agentCountOf(rows);
  const settingUp = rows.filter((r) => r.image != null && r.image.state !== 'ready').length;
  const count = agents === 0 ? 'no agents' : agents === 1 ? '1 agent' : `${agents} agents`;
  return settingUp > 0 ? `${count} · ${settingUp} setting up` : count;
}

// The RAM warning's rows in words: each agent's and model's details, the
// boxes' lines and a model's Stop, which says first which agents go with
// it. Pure (zero RN imports).
import type { MemoryLevel } from '../../../engine/memory';
import { formatBytes } from '../../env/logic/format.ts';
import { agentCount, nameList } from './memoryCopy.ts';
import type { AgentRow, ModelRow } from './memoryRows.ts';

function bytes(n: number | null): string {
  return n == null ? '' : formatBytes(n);
}

/** "opencode · 412 MB · idle · on Qwen3.5 4B". */
export function agentLine(row: AgentRow): string {
  return [row.kindLabel, bytes(row.bytes), row.working ? 'working' : 'idle', row.modelName ? `on ${row.modelName}` : '']
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** "2.9 GB · loaded · 2 agents on it". */
export function modelLine(row: ModelRow): string {
  const n = row.agentNames.length;
  const on = n === 0 ? 'no agents on it' : `${agentCount(n)} on it`;
  return [bytes(row.bytes), row.ready ? 'loaded' : 'loading', on].filter((part) => part.length > 0).join(' · ');
}

/** The agents box's line: how many and what they take together. */
export function agentsBoxLine(count: number, total: number | null): string {
  return total == null ? `${agentCount(count)} running` : `${agentCount(count)} running · ${formatBytes(total)} together`;
}

/** The models box's line; while memory is tight it points at the big eaters. */
export function modelsBoxLine(level: MemoryLevel, total: number | null): string {
  if (level === 'ok' || total == null) return 'A loaded model keeps its whole brain in RAM, often more than all the agents together.';
  return `Local models are the big eaters here: ${formatBytes(total)} between them. Stopping one stops the agents on it first.`;
}

/** The in-place confirm of a model's Stop; null when no agent runs on it (it just stops). */
export function modelStopConfirm(name: string, agentNames: readonly string[]): string | null {
  const n = agentNames.length;
  if (n === 0) return null;
  const who = n === 1 ? agentNames[0] : `${agentCount(n)} (${nameList(agentNames)})`;
  return `Stopping ${name} stops ${who} first. Nothing is lost: ${n === 1 ? 'it just naps' : 'they just nap'} until you start ${n === 1 ? 'it' : 'them'} again.`;
}

/** The confirm's button: the model and its agents. */
export function modelStopAll(agents: number): string {
  return agents === 1 ? 'Stop both' : 'Stop them all';
}

// What the RAM warning lists, from the guard's reading and the app's own
// records: each running agent (its name and kind, what it takes, working
// or idle, whether the countdown would stop it) and each loaded local model
// (what it takes, the agents on it), biggest first, and the phone's memory
// as used and free. Pure (zero RN imports).
import type { AgentId } from '../../../engine/agents/records';
import type { MemoryStatus } from '../../../engine/memory';

/** An agent as the app knows it: its name and its kind's label. */
export type AgentInfo = { name: string; kindLabel: string };

export type AgentRow = {
  agentId: AgentId;
  name: string;
  kindLabel: string;
  bytes: number | null;
  working: boolean;
  /** The countdown would stop this one. */
  next: boolean;
  /** The local model it runs on, by name; null for none. */
  modelName: string | null;
};

export type ModelRow = {
  modelId: string;
  name: string;
  bytes: number | null;
  /** Answered ready; false while it loads. */
  ready: boolean;
  /** The agents on it, by name: stopping the model stops these first. */
  agentNames: string[];
};

export type RamUse = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  /** Used over total, 0 to 1. */
  usedFraction: number;
  /** Where the warn line sits as a used fraction, 0 to 1; null when the guard gave none. */
  warnFraction: number | null;
};

/** Said for an agent the app no longer knows (deleted meanwhile). */
export const UNKNOWN_AGENT = 'an agent';

export function agentName(info: Readonly<Record<AgentId, AgentInfo>>, id: AgentId | null | undefined): string {
  return (id && info[id]?.name) || UNKNOWN_AGENT;
}

function biggestFirst(a: { bytes: number | null; name: string }, b: { bytes: number | null; name: string }): number {
  return (b.bytes ?? -1) - (a.bytes ?? -1) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

export function agentRows(status: MemoryStatus, info: Readonly<Record<AgentId, AgentInfo>>): AgentRow[] {
  const modelNames = new Map(status.models.map((m) => [m.modelId, m.name]));
  return status.agents
    .map((a) => ({
      agentId: a.agentId,
      name: agentName(info, a.agentId),
      kindLabel: info[a.agentId]?.kindLabel ?? '',
      bytes: a.bytes,
      working: a.working,
      next: a.agentId === status.nextStopAgentId,
      modelName: a.modelId ? (modelNames.get(a.modelId) ?? null) : null,
    }))
    .sort(biggestFirst);
}

export function modelRows(status: MemoryStatus, info: Readonly<Record<AgentId, AgentInfo>>): ModelRow[] {
  return status.models
    .map((m) => ({
      modelId: m.modelId,
      name: m.name,
      bytes: m.bytes,
      ready: m.ready,
      agentNames: m.agentIds.map((id) => agentName(info, id)),
    }))
    .sort(biggestFirst);
}

/** What the rows take together, counting only the ones read; null when none was. */
export function totalBytes(rows: readonly { bytes: number | null }[]): number | null {
  const known = rows.filter((r) => r.bytes != null);
  return known.length === 0 ? null : known.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
}

/** The phone's memory as used and free; null when the guard has not measured it. */
export function ramUse(status: Pick<MemoryStatus, 'totalBytes' | 'availBytes' | 'warnBelowBytes'>): RamUse | null {
  const total = status.totalBytes;
  if (!(total > 0)) return null;
  const free = Math.min(Math.max(status.availBytes, 0), total);
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: total - free,
    usedFraction: clamp((total - free) / total),
    warnFraction: status.warnBelowBytes > 0 ? clamp(1 - status.warnBelowBytes / total) : null,
  };
}

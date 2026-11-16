// The phone's memory as a map, for the RAM warning's figure: each of our
// local models and agents as its own block (biggest first, as the lists
// under it), then everything else Android holds, then what is free, each
// as a fraction of the whole. Our readings and Android's free memory are
// taken at different moments, so when ours add up to more than is used we
// scale them down to fit. Pure (zero RN imports).
import type { AgentRow, ModelRow, RamUse } from './memoryRows.ts';

/** model: a local model · agent: an agent · next: the agent the countdown would stop · other: Android and other apps. */
export type MapInk = 'model' | 'agent' | 'next' | 'other';

/** One block on the strip; `start` and `width` are fractions of the phone's memory. */
export type MapBlock = { key: string; ink: MapInk; start: number; width: number };

export type RamMap = {
  /** Ours (models, then agents), then everything else; free is what is left at the right. */
  blocks: MapBlock[];
  /** What our models take together as read; null with none read. */
  models: number | null;
  /** What our agents take together as read; null with none read. */
  agents: number | null;
  /** Used memory that is not ours: Android, other apps (never below 0). */
  other: number;
  free: number;
  /** The next-up agent has a block of its own. */
  hasNext: boolean;
};

export const modelKey = (modelId: string) => `model:${modelId}`;
export const agentKey = (agentId: string) => `agent:${agentId}`;

function sum(rows: readonly { bytes: number | null }[]): number | null {
  const known = rows.filter((r) => r.bytes != null && r.bytes > 0);
  return known.length === 0 ? null : known.reduce((n, r) => n + (r.bytes ?? 0), 0);
}

export function ramMap(use: RamUse, agents: readonly AgentRow[], models: readonly ModelRow[]): RamMap {
  const modelBytes = sum(models);
  const agentBytes = sum(agents);
  const ours = (modelBytes ?? 0) + (agentBytes ?? 0);
  const scale = ours > use.usedBytes && ours > 0 ? use.usedBytes / ours : 1;
  const blocks: MapBlock[] = [];
  let at = 0;
  const place = (key: string, ink: MapInk, bytes: number) => {
    const width = (bytes * scale) / use.totalBytes;
    blocks.push({ key, ink, start: at, width });
    at += width;
  };
  for (const m of models) if (m.bytes != null && m.bytes > 0) place(modelKey(m.modelId), 'model', m.bytes);
  for (const a of agents) if (a.bytes != null && a.bytes > 0) place(agentKey(a.agentId), a.next ? 'next' : 'agent', a.bytes);
  const other = Math.max(0, use.usedBytes - ours * scale);
  if (other > 0) place('other', 'other', other);
  return {
    blocks,
    models: modelBytes,
    agents: agentBytes,
    other,
    free: use.freeBytes,
    hasNext: blocks.some((b) => b.ink === 'next'),
  };
}

/** A row's share of the phone's memory, as its block on the map; 0 when it has none (not read). */
export function shareOf(map: RamMap, key: string): number {
  return map.blocks.find((b) => b.key === key)?.width ?? 0;
}

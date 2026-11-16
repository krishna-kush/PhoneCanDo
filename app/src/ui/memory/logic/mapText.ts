// The RAM warning's figure in words: the readout over the strip (free in
// big figures, the whole and the share used beside it) and the key under
// it, one entry per kind of block. Pure (zero RN imports).
import { formatBytes } from '../../env/logic/format.ts';
import type { RamUse } from './memoryRows.ts';
import type { MapInk, RamMap } from './ramMap.ts';

export type Readout = { free: string; of: string; used: string };

/** "3.4 GB" · "free of 12 GB" · "71% used". */
export function ramReadout(use: RamUse): Readout {
  return {
    free: formatBytes(use.freeBytes),
    of: `free of ${formatBytes(use.totalBytes)}`,
    used: `${usedPercent(use)}% used`,
  };
}

/** Used over total as a whole percent, as the meter's screen reader hears it. */
export function usedPercent(use: RamUse): number {
  return Math.round(use.usedFraction * 100);
}

export type KeyInk = MapInk | 'free';

/** One entry of the key: its swatch, what it is and what it takes ('' for none). */
export type KeyEntry = { ink: KeyInk; label: string; bytes: string };

/** The key under the strip: ours by kind, the one next up by name, the rest and what is free. */
export function mapKey(map: RamMap, nextName: string | null): KeyEntry[] {
  const out: KeyEntry[] = [];
  if (map.models != null) out.push({ ink: 'model', label: 'local models', bytes: formatBytes(map.models) });
  if (map.agents != null) out.push({ ink: 'agent', label: 'agents', bytes: formatBytes(map.agents) });
  if (map.hasNext && nextName) out.push({ ink: 'next', label: `next up: ${nextName}`, bytes: '' });
  if (map.other > 0) out.push({ ink: 'other', label: 'Android & other apps', bytes: formatBytes(map.other) });
  out.push({ ink: 'free', label: 'free', bytes: formatBytes(map.free) });
  return out;
}

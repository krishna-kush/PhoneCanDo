// The caps on what runs at once (Settings → Agents & models) in words and
// choices: the options offered, a playful name for each, what a cap does
// and the hub's short line. Pure (zero RN imports). null is no cap, the
// default.
import type { RunLimits } from '../../../engine/runLimits';

export type CapKind = 'agents' | 'models';
export type Cap = number | null;

const OFFERED: Record<CapKind, readonly Cap[]> = {
  agents: [null, 1, 2, 3, 4, 5, 6, 8],
  // Each model keeps its whole brain in RAM: few phones hold more than two.
  models: [null, 1, 2, 3],
};

const NAMES: Record<CapKind, Readonly<Record<number, string>>> = {
  agents: {
    1: 'monk mode',
    2: 'dynamic duo',
    3: 'three-piece band',
    4: 'four on the floor',
    5: 'high five',
    6: 'half a dozen',
    8: 'octopus mode',
  },
  models: { 1: 'one big brain', 2: 'two brains', 3: 'brain trust' },
};

/** The choices, no cap first; a saved cap we don't offer joins them in its place. */
export function capOptions(kind: CapKind, current: Cap): Cap[] {
  const offered = OFFERED[kind];
  if (current == null || offered.includes(current)) return [...offered];
  return [null, ...[...offered.filter((c): c is number => c != null), current].sort((a, b) => a - b)];
}

/** What its chip shows: ∞ or the number. */
export function capChip(cap: Cap): string {
  return cap == null ? '∞' : String(cap);
}

/** Its playful name. */
export function capName(kind: CapKind, cap: Cap): string {
  if (cap == null) return kind === 'agents' ? 'go wild' : 'all you can eat';
  return NAMES[kind][cap] ?? (kind === 'agents' ? `${cap} at once` : `${cap} brains`);
}

/** What the cap does, plainly. */
export function capNote(kind: CapKind, cap: Cap): string {
  if (kind === 'agents') {
    if (cap == null) return 'No cap: start as many agents as you like. The RAM guard below still keeps watch.';
    const how = cap === 1 ? 'One agent at a time.' : `Up to ${cap} agents at once.`;
    return `${how} Start one more and we stop the agent that has sat idle longest (a minute or more) to make room; if they're all busy, it won't start until you stop one.`;
  }
  if (cap == null) {
    return 'No cap: load as many local models as fit. Each one keeps its whole brain in RAM, so the RAM guard watches these closely.';
  }
  const how = cap === 1 ? 'One local model loaded at a time.' : `Up to ${cap} local models loaded at once.`;
  return `${how} An agent that needs one more won't start until you stop a model (on the Models page, or from the RAM warning).`;
}

function count(n: number | null, one: string, many: string): string {
  return n == null ? `∞ ${many}` : `${n} ${n === 1 ? one : many}`;
}

/** The hub's line: "∞ agents · ∞ models · no caps", "2 agents · ∞ models at most". */
export function capsLine(limits: RunLimits): string {
  const both = `${count(limits.maxAgents, 'agent', 'agents')} · ${count(limits.maxModels, 'model', 'models')}`;
  return limits.maxAgents == null && limits.maxModels == null ? `${both} · no caps` : `${both} at most`;
}

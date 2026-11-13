// A-01's face for an agent: its engine state as a mood, and the agent's
// serial; its shape and what it wears are its mascot (state/mascots.ts).
// Pure (zero RN imports). The face is never the only signal: rows say the
// state in words too.
import type { EngineState } from '../../../engine/agents/records';

/**
 * awake: running · busy: starting, stopping or installing · asleep: stopped ·
 * oops: failed or died · sweaty: A-01 itself while the phone is nearly out
 * of memory (the RAM warning; no engine state maps to it) · happy: A-01
 * itself, pleased (the "Having fun?" card; no engine state maps to it).
 */
export type Mood = 'awake' | 'busy' | 'asleep' | 'oops' | 'sweaty' | 'happy';

export function moodOf(state: EngineState | null | undefined, installing = false): Mood {
  if (installing) return 'busy';
  switch (state) {
    case 'ready':
      return 'awake';
    case 'starting':
    case 'stopping':
      return 'busy';
    case 'died':
    case 'failed':
      return 'oops';
    default:
      return 'asleep';
  }
}

type Dated = { id: string; createdAt: number };

/** "A-01" for the oldest agent, "A-02" for the next…; like the site's A-01 and A-02. */
export function agentSerial(agents: readonly Dated[], id: string): string {
  const order = [...agents].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  const n = order.findIndex((a) => a.id === id) + 1;
  return `A-${String(Math.max(n, 1)).padStart(2, '0')}`;
}

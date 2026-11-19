// A-01's face for an agent: its engine state as a mood; its shape and what
// it wears are its mascot (state/mascots.ts). An agent's code is its desk
// (state/desks.ts): the A-numbers are our own characters'.
// Pure (zero RN imports). The face is never the only signal: rows say the
// state in words too.
import type { EngineState } from '../../../engine/agents/records';

/**
 * awake: running · busy: starting, stopping or installing · asleep: stopped ·
 * oops: failed or died · sweaty: A-01 itself while the phone is nearly out
 * of memory (the RAM warning; no engine state maps to it) · happy: A-01
 * itself, pleased (the "Having fun?" card; no engine state maps to it) ·
 * thinking: running, and its status line (agents_status, state/presence.ts)
 * says it is thinking.
 */
export type Mood = 'awake' | 'busy' | 'asleep' | 'oops' | 'sweaty' | 'happy' | 'thinking';

export function moodOf(state: EngineState | null | undefined, installing = false, thinking = false): Mood {
  if (installing) return 'busy';
  switch (state) {
    case 'ready':
      return thinking ? 'thinking' : 'awake';
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

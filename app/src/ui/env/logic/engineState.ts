// An engine's state as the word shown next to its dot (the header's
// EngineDot, so a state looks the same everywhere and colour is never the
// only signal). Pure (zero RN imports).
import type { EngineState } from '../../../engine/agents/records';

const WORDS: Record<EngineState, string> = {
  ready: 'Running',
  starting: 'Starting',
  stopping: 'Stopping',
  stopped: 'Stopped',
  died: 'Stopped unexpectedly',
  failed: "Couldn't start",
};

export function engineStateWord(state: EngineState | null | undefined): string {
  return WORDS[state ?? 'stopped'];
}

/**
 * A running engine's word once its activity is known (`idle`: the runner's
 * idle rule, the kind's quiet time with no chat working): Working or Idle.
 * Any other state, or activity not known, keeps engineStateWord's word.
 */
export function activityWord(state: EngineState | null | undefined, idle: boolean | null): string {
  if (state !== 'ready' || idle === null) return engineStateWord(state);
  return idle ? 'Idle' : 'Working';
}

/** Whether Stop (not Start) is the button to show. */
export function engineIsUp(state: EngineState | null | undefined): boolean {
  return state === 'ready' || state === 'starting';
}

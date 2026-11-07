// An engine state as a dot tone plus the word that goes with it (the dot is
// never the only signal). Pure: no RN imports.
import type { EngineState } from '../../../engine/agents/records';

export type DotTone = 'running' | 'busy' | 'error' | 'off';

export function engineDot(state: EngineState | undefined): { tone: DotTone; label: string } {
  switch (state) {
    case 'ready':
      return { tone: 'running', label: 'running' };
    case 'starting':
    case 'stopping':
      return { tone: 'busy', label: state };
    case 'died':
    case 'failed':
      return { tone: 'error', label: state };
    default:
      return { tone: 'off', label: 'stopped' };
  }
}

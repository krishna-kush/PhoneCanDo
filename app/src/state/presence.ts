// Presence as the screens read it (engine/presence/): who has the phone's
// controls (an agent driving, or a hand-over to you) and each agent's
// status line. The first hydrate reads the frame and subscribes to the
// runner's changes (each carries the whole frame) and to the app coming
// back to the foreground. Unchanged parts stay the same objects, so a row
// that shows one agent's line skips the render when another's changes.
import { AppState } from 'react-native';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import { onPresence, presenceAct, presenceSnapshot } from '../engine/presence/native';
import { NO_PRESENCE } from '../engine/presence/parse';
import type { AgentStatus, PresenceFrame, UserAct } from '../engine/presence/types';
import { keepUnchangedMap, sameValue } from './logic/keepUnchanged';

interface PresenceState extends PresenceFrame {
  /** Reads the frame now; subscribes once. */
  hydratePresence: () => void;
  /** A hand-over button; false when the runner refused it. The frame comes back in its event. */
  act: (act: UserAct) => boolean;
}

let subscribed = false;

export const usePresenceStore = create<PresenceState>((set, get) => {
  const take = (next: PresenceFrame) => {
    const now = get();
    const patch: Partial<PresenceFrame> = {};
    if (!sameValue(now.driver, next.driver)) patch.driver = next.driver;
    if (!sameValue(now.handOver, next.handOver)) patch.handOver = next.handOver;
    const statuses = keepUnchangedMap(now.statuses, next.statuses);
    if (statuses !== now.statuses) patch.statuses = statuses;
    if (Object.keys(patch).length > 0) set(patch);
  };

  const read = () => take(presenceSnapshot());

  return {
    ...NO_PRESENCE,

    hydratePresence: () => {
      if (!subscribed) {
        subscribed = true;
        onPresence(take);
        AppState.addEventListener('change', (state) => {
          if (state === 'active') read();
        });
      }
      read();
    },

    act: (act) => {
      const ok = presenceAct(act);
      // A refused act most likely means the frame moved on: read it again.
      if (!ok) read();
      return ok;
    },
  };
});

/** An agent's status line; null while it has none. Re-renders only when its own changes. */
export function useAgentStatus(agentId: AgentId | null | undefined): AgentStatus | null {
  return usePresenceStore((s) => (agentId ? (s.statuses[agentId] ?? null) : null));
}

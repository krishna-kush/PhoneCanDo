// Each coding agent's desk code (logic/desks.ts): its machine's room number
// and its desk letter there, the first free ones. A new agent takes its
// seat as it is made (flows/newAgent.ts), so its name can carry the code;
// an agent without one (made before desks, or a seat lost with the
// storage) is seated oldest first when the list is read
// (ui/common/desk/useDeskSeats.ts). Kept in AsyncStorage on this phone; a
// deleted agent's seat goes, and its code is free for the next one.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import type { ImageId } from '../engine/linux/types';
import { bindSeat, NO_DESKS, peekSeat, readDesks, seatAgents, type Desks, type Seat } from './logic/desks';

const KEY = 'phonecando.desks.v1';

type DesksState = {
  hydrated: boolean;
  desks: Desks;

  hydrate: () => Promise<void>;
  /** Seats every agent in [agents] (oldest first) that has no seat; drops the deleted ones'. */
  seat: (agents: readonly { id: AgentId; imageId: ImageId }[]) => void;
  /** The seat the next agent on [imageId] gets; nothing is held until bind. */
  peek: (imageId: ImageId) => Seat;
  /** Puts the agent just made on [imageId] at the seat peek gave. */
  bind: (agentId: AgentId, imageId: ImageId, seat: Seat) => void;
};

// Best-effort: the in-memory desks apply for this run.
function save(desks: Desks) {
  AsyncStorage.setItem(KEY, JSON.stringify(desks)).catch(() => {});
}

let reading: Promise<void> | null = null;

export const useDesksStore = create<DesksState>((set, get) => ({
  hydrated: false,
  desks: NO_DESKS,

  hydrate: () => {
    reading ??= (async () => {
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(KEY);
      } catch {
        // unreadable: everyone is seated again
      }
      let kept = NO_DESKS;
      try {
        kept = readDesks(JSON.parse(raw ?? '{}'));
      } catch {
        // malformed: everyone is seated again
      }
      set({ desks: kept, hydrated: true });
    })();
    return reading;
  },

  seat: (agents) => {
    const desks = seatAgents(get().desks, agents);
    if (desks === get().desks) return;
    set({ desks });
    save(desks);
  },

  peek: (imageId) => peekSeat(get().desks, imageId),

  bind: (agentId, imageId, seat) => {
    const desks = bindSeat(get().desks, agentId, imageId, seat);
    set({ desks });
    save(desks);
  },
}));

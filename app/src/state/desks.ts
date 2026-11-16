// Each coding agent's desk code (logic/desks.ts): its machine's room number
// and its desk letter there, given once and never again. A new agent takes
// its seat as it is made (flows/newAgent.ts), so its name can carry the
// code; an agent without one (made before desks, or a seat lost with the
// storage) is seated oldest first when the list is read
// (ui/common/desk/useDeskSeats.ts). Kept in AsyncStorage on this phone; a
// deleted agent's seat goes, its code stays retired.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import type { ImageId } from '../engine/linux/types';
import { bindSeat, NO_DESKS, readDesks, seatAgents, takeSeat, type Desks, type Seat } from './logic/desks';

const KEY = 'phonecando.desks.v1';

type DesksState = {
  hydrated: boolean;
  desks: Desks;

  hydrate: () => Promise<void>;
  /** Seats every agent in [agents] (oldest first) that has no seat; drops the deleted ones'. */
  seat: (agents: readonly { id: AgentId; imageId: ImageId }[]) => void;
  /** Gives out the next seat on [imageId], for an agent about to be made; never given again. */
  take: (imageId: ImageId) => Seat;
  /** Puts the agent just made at the seat it took. */
  bind: (agentId: AgentId, seat: Seat) => void;
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

  take: (imageId) => {
    const { seat, desks } = takeSeat(get().desks, imageId);
    set({ desks });
    save(desks);
    return seat;
  },

  bind: (agentId, seat) => {
    const desks = bindSeat(get().desks, agentId, seat);
    set({ desks });
    save(desks);
  },
}));

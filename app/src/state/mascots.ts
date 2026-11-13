// Each agent's mascot (mascot/look.ts): picked at random the first time the
// agent shows up, so no two here look alike while that can last, and
// changed on its Mascot page. Kept in AsyncStorage by agent id; a deleted
// agent's look goes the next time the list is read (ui/common/face/useMascotPicks.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { readLook, type Look } from '../../../mascot/look.ts';
import { assignLooks, pickLook } from '../../../mascot/pick.ts';
import type { AgentId } from '../engine/agents/records';

const KEY = 'phonecando.mascots.v1';

type Looks = Readonly<Record<AgentId, Look>>;

type MascotsState = {
  hydrated: boolean;
  looks: Looks;

  hydrate: () => Promise<void>;
  /** Looks for [ids], oldest first: a new agent gets one, a deleted one's goes. */
  assign: (ids: readonly AgentId[]) => void;
  setLook: (id: AgentId, look: Look) => void;
  /** A new look for [id] at random, unlike the one it has and the other agents'. */
  surprise: (id: AgentId) => void;
};

// Best-effort: the in-memory looks apply for this run.
function save(looks: Looks) {
  AsyncStorage.setItem(KEY, JSON.stringify(looks)).catch(() => {});
}

function parse(raw: string | null): Looks {
  try {
    const kept: Record<AgentId, Look> = {};
    for (const [id, v] of Object.entries(JSON.parse(raw ?? '{}') as Record<string, unknown>)) {
      const look = readLook(v);
      if (look) kept[id] = look;
    }
    return kept;
  } catch {
    return {};
  }
}

export const useMascotsStore = create<MascotsState>((set, get) => ({
  hydrated: false,
  looks: {},

  hydrate: async () => {
    if (get().hydrated) return;
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(KEY);
    } catch {
      // unreadable: everyone picks again
    }
    set({ looks: { ...parse(raw), ...get().looks }, hydrated: true });
  },

  assign: (ids) => {
    const looks = assignLooks(get().looks, ids, Math.random);
    if (looks === get().looks) return;
    set({ looks });
    save(looks);
  },

  setLook: (id, look) => {
    const looks = { ...get().looks, [id]: look };
    set({ looks });
    save(looks);
  },

  surprise: (id) => {
    const { looks } = get();
    get().setLook(id, pickLook(Object.values(looks), Math.random));
  },
}));

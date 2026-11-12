// The "Having fun?" card's memory, kept in AsyncStorage: how many runs
// finished well, when it last asked and what you answered
// (logic/recommendAsk.ts decides), and the agent it shows for now.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import { answered, FRESH, parseAsk, runFinished, started, type Answer, type AskState } from './logic/recommendAsk';

const KEY = 'phonecando.recommend.v1';

type RecommendState = {
  hydrated: boolean;
  ask: AskState;
  /** The agent whose finished run the card shows under; null while hidden. In memory only. */
  cardFor: AgentId | null;

  hydrate: () => Promise<void>;
  /** A run of [agentId] finished well; [looking]: its chat was on screen. */
  runFinished: (agentId: AgentId, looking: boolean) => void;
  answer: (answer: Answer) => void;
  hide: () => void;
};

// Best-effort: the in-memory state applies for this run.
function save(ask: AskState) {
  AsyncStorage.setItem(KEY, JSON.stringify(ask)).catch(() => {});
}

export const useRecommendStore = create<RecommendState>((set, get) => ({
  hydrated: false,
  ask: FRESH,
  cardFor: null,

  hydrate: async () => {
    if (get().hydrated) return;
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(KEY);
    } catch {
      // unreadable: start fresh
    }
    const ask = started(parseAsk(raw), Date.now());
    set({ ask, hydrated: true });
    save(ask);
  },

  runFinished: (agentId, looking) => {
    // Before the stored count is read, a run would overwrite it.
    if (!get().hydrated) return;
    const { state, ask } = runFinished(get().ask, Date.now(), looking);
    set(ask ? { ask: state, cardFor: agentId } : { ask: state });
    save(state);
  },

  answer: (answer) => {
    const ask = answered(get().ask, answer);
    set({ ask, cardFor: null });
    save(ask);
  },

  hide: () => set({ cardFor: null }),
}));

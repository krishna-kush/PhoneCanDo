// The custom agent kinds (the user's own, one file each in the runner's
// folder, with what keeps one from loading) and a count that grows each
// time the kinds change, so what lists kinds (the Choose agent step) reads
// them again. The kinds themselves stay in engine/agents/registry.ts.
import { create } from 'zustand';
import { reloadKinds } from '../engine/agents/registry';
import { listUserKinds, type UserKindFile } from '../engine/agents/user/native';

interface KindsState {
  userKinds: UserKindFile[];
  /** Grows with each change to the kinds. */
  version: number;
  /** Reads the user's folder again. */
  readUserKinds: () => void;
  /** After a save or delete: the registry and the user's folder, read again. */
  refreshKinds: () => void;
}

export const useKindsStore = create<KindsState>((set) => ({
  userKinds: [],
  version: 0,
  readUserKinds: () => set({ userKinds: listUserKinds() }),
  refreshKinds: () => {
    reloadKinds();
    set((s) => ({ userKinds: listUserKinds(), version: s.version + 1 }));
  },
}));

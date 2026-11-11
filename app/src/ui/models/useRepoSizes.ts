import { create } from 'zustand';
import { repoSizes } from '../../engine/models/native';
import type { RepoSizes } from '../../engine/models/types';

// The download sizes of the Hugging Face repositories the list has shown.
// A row asks when it first comes into view (parts/HitRow.tsx), and the rows
// that come into view together go in one native call. Native asks the Hub
// once per repository at most and keeps the answer for the process; one it
// held back (the Hub's call limit runs low) or couldn't read is asked again
// when its row is drawn again.
interface SizesState {
  sizes: Record<string, RepoSizes>;
  ask: (repo: string) => void;
}

// Rows that come into view within this long share one call.
const BATCH_MS = 50;
// What native takes in one call: a list page's worth.
const MAX_PER_CALL = 30;

let waiting: string[] = [];
const asking = new Set<string>();

export const useRepoSizes = create<SizesState>((_set, get) => ({
  sizes: {},

  ask: (repo) => {
    if (get().sizes[repo] || asking.has(repo)) return;
    asking.add(repo);
    waiting.push(repo);
    if (waiting.length === 1) setTimeout(() => void send(), BATCH_MS);
  },
}));

async function send() {
  const repos = waiting;
  waiting = [];
  for (let i = 0; i < repos.length; i += MAX_PER_CALL) {
    const part = repos.slice(i, i + MAX_PER_CALL);
    try {
      const found = await repoSizes(part);
      useRepoSizes.setState((s) => ({ sizes: { ...s.sizes, ...found } }));
    } catch {
      // No sizes this time: the rows show without them.
    } finally {
      part.forEach((repo) => asking.delete(repo));
    }
  }
}

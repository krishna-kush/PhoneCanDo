import { useEffect } from 'react';
import { useAgentsStore } from '../../../state/agents';
import { useMascotsStore } from '../../../state/mascots';

// Gives every agent its mascot: reads the kept looks, then whenever the
// agents change, picks one for each new agent and drops a deleted one's
// (state/mascots.ts). Mounted once, in App.tsx.
export function useMascotPicks() {
  const agents = useAgentsStore((s) => s.agents);
  const listed = useAgentsStore((s) => s.hydrated);
  const hydrated = useMascotsStore((s) => s.hydrated);

  useEffect(() => {
    void useMascotsStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!listed || !hydrated) return;
    const ids = [...agents].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)).map((a) => a.id);
    useMascotsStore.getState().assign(ids);
  }, [agents, listed, hydrated]);
}

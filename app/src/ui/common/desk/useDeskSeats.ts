import { useEffect } from 'react';
import { useAgentsStore } from '../../../state/agents';
import { useDesksStore } from '../../../state/desks';

// Gives every agent its desk: reads the kept desks, then whenever the
// agents change, seats each one without a desk, oldest first, and drops a
// deleted one's (state/desks.ts). Mounted once, in App.tsx.
export function useDeskSeats() {
  const agents = useAgentsStore((s) => s.agents);
  const listed = useAgentsStore((s) => s.hydrated);
  const hydrated = useDesksStore((s) => s.hydrated);

  // Read once the agents are listed: the first frame waits on that read,
  // and the desks have no one to seat before it.
  useEffect(() => {
    if (listed) void useDesksStore.getState().hydrate();
  }, [listed]);

  useEffect(() => {
    if (!listed || !hydrated) return;
    const oldestFirst = [...agents].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
    useDesksStore.getState().seat(oldestFirst.map((a) => ({ id: a.id, imageId: a.imageId })));
  }, [agents, listed, hydrated]);
}

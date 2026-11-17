import { useState } from 'react';
import type { SetupState } from '../logic/stage';

// A hop for the agent's face each time the setup moves on a stage, and
// once more at the finale; none for where it opens.
export function useStageHop({ stage, done }: Pick<SetupState, 'stage' | 'done'>): number {
  const [seen, setSeen] = useState({ stage, done });
  const [hop, setHop] = useState(0);
  if (stage > seen.stage || (done && !seen.done)) {
    setSeen({ stage, done });
    setHop((h) => h + 1);
  } else if (stage !== seen.stage || done !== seen.done) {
    setSeen({ stage, done });
  }
  return hop;
}

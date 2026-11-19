import { useMemo } from 'react';
import { PLAIN } from '../../../../../mascot/look.ts';
import { useAgentsStore } from '../../../state/agents';
import { useMascotsStore } from '../../../state/mascots';
import { moodOf } from '../../common/face/mood';
import { BUNKS, type Bunk, bunksOf, type Crew, inkOf, keyLabel } from './logic/bunks';

/** The key's bunks and its spoken label, as the first three agents are now (logic/bunks.ts). */
export function useBunks(): { bunks: Bunk[]; label: string } {
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const looks = useMascotsStore((s) => s.looks);
  return useMemo(() => {
    const crew: Crew[] = agents.slice(0, BUNKS).map((a) => ({
      name: a.name,
      ink: inkOf(looks[a.id] ?? PLAIN),
      mood: moodOf(statuses[a.id]?.state),
    }));
    return { bunks: bunksOf(crew), label: keyLabel(crew) };
  }, [agents, statuses, looks]);
}

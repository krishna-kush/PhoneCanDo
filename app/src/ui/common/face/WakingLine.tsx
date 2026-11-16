import { useState } from 'react';
import type { AgentId } from '../../../engine/agents/records';
import { useDesk } from '../desk/useDesk';
import { wakingLine } from './lines';
import PlainText from '../PlainText';

// The starting agent's caption under a loader, by its desk ("desk 1b"):
// one line per start, under the plain words, never instead of them.
export default function WakingLine({ agentId }: { agentId: AgentId }) {
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const desk = useDesk(agentId);
  return (
    <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
      {`${desk} · ${wakingLine(seed)}`}
    </PlainText>
  );
}

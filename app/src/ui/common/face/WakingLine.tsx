import { useState } from 'react';
import type { AgentId } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import { wakingLine } from './lines';
import { agentSerial } from './mood';
import PlainText from '../PlainText';

// The starting agent's caption under a loader, by its own serial (A-04):
// one line per start, under the plain words, never instead of them.
export default function WakingLine({ agentId }: { agentId: AgentId }) {
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const serial = useAgentsStore((s) => agentSerial(s.agents, agentId));
  return (
    <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
      {`${serial} · ${wakingLine(seed)}`}
    </PlainText>
  );
}

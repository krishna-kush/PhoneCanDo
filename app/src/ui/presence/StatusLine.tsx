import type { AgentId } from '../../engine/agents/records';
import { useAgentStatus } from '../../state/presence';
import PlainText from '../common/PlainText';
import { statusText } from './copy';

type Props = { agentId: AgentId | null | undefined; fontSize?: number };

// An agent's "what I'm doing now" (agents_status) in one short amber mono
// line, cut with an ellipsis, under its name: Home's header and its
// drawer row. Nothing while it has no line (the runner clears it at its
// run's end). The row it sits in says it to a screen reader (statusLabel).
export default function StatusLine({ agentId, fontSize = 11 }: Props) {
  const status = useAgentStatus(agentId);
  if (!status) return null;
  return (
    <PlainText
      fontFamily="mono"
      fontSize={fontSize}
      color="secondaryInk"
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {statusText(status)}
    </PlainText>
  );
}

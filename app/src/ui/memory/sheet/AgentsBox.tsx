import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import SectionTitle from '../../common/SectionTitle';
import { totalBytes, type AgentRow } from '../logic/memoryRows';
import { agentsBoxLine } from '../logic/rowText';
import AgentStopRow from './AgentStopRow';

// The running agents, biggest first, each with its Stop.
export default function AgentsBox({ rows }: { rows: AgentRow[] }) {
  if (rows.length === 0) return null;
  return (
    <YStack gap="1">
      <SectionTitle>Agents</SectionTitle>
      <PlainText fontFamily="mono" fontSize={12} color="dim">
        {agentsBoxLine(rows.length, totalBytes(rows))}
      </PlainText>
      <YStack marginTop="1">
        {rows.map((row) => (
          <AgentStopRow key={row.agentId} row={row} />
        ))}
      </YStack>
    </YStack>
  );
}

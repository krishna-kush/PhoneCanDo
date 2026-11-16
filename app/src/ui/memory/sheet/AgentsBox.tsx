import type { AgentId } from '../../../engine/agents/records';
import RowGroup from '../../common/rows/RowGroup';
import { totalBytes, type AgentRow } from '../logic/memoryRows';
import { agentKey, shareOf, type RamMap } from '../logic/ramMap';
import { agentsBoxLine } from '../logic/rowText';
import AgentStopRow from './AgentStopRow';
import BoxLine from './BoxLine';

type Props = {
  rows: AgentRow[];
  /** The countdown's seconds left; null without one. */
  seconds: number | null;
  /** The strip's blocks, for each row's share bar; null when memory was not measured. */
  map: RamMap | null;
  /** Opens an agent's page. */
  onOpen: (agentId: AgentId) => void;
};

// The running agents in one box, biggest first: how many and what they
// take together, then each with its Stop.
export default function AgentsBox({ rows, seconds, map, onOpen }: Props) {
  if (rows.length === 0) return null;
  return (
    <RowGroup title="Agents" barcode="memoryAgents">
      <BoxLine mono>{agentsBoxLine(rows.length, totalBytes(rows))}</BoxLine>
      {rows.map((row) => (
        <AgentStopRow
          key={row.agentId}
          row={row}
          seconds={seconds}
          share={map ? shareOf(map, agentKey(row.agentId)) : 0}
          onOpen={() => onOpen(row.agentId)}
        />
      ))}
    </RowGroup>
  );
}

import { XStack, YStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';
import { ROW_GUTTER } from '../../common/rows/place';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import { KEPT_LINE, stopRows, stopsHead, type StopRow } from '../logic/stops';
import { useStops } from './useStops';

// What the install will stop, read live while the box waits on your tap:
// a line saying it, then a row per running agent (its face, busy or idle,
// what happens to it) and per kind of job under way, and what stays.
export default function StopList() {
  const { agents, jobs } = useStops();
  const rows = stopRows(agents, jobs);
  return (
    <YStack gap="2">
      <PlainText fontSize={14} color="muted">
        {stopsHead(agents, jobs)}
      </PlainText>
      {rows.length > 0 ? (
        <RowGroup title="What the install stops" barcode="installStops">
          {rows.map((row) => (
            <Row key={`${row.kind}:${row.id}`} row={row} />
          ))}
        </RowGroup>
      ) : null}
      <PlainText fontSize={13} color="dim">
        {KEPT_LINE}
      </PlainText>
    </YStack>
  );
}

function Row({ row }: { row: StopRow }) {
  return (
    <RowFrame bare>
      <XStack paddingHorizontal={ROW_GUTTER} paddingVertical="3" gap="3" alignItems="flex-start">
        <YStack width={20} paddingTop={2} alignItems="center">
          {row.kind === 'agent' ? <Face agentId={row.id} /> : <YStack width={10} height={10} marginTop={3} backgroundColor="secondary" />}
        </YStack>
        <YStack flex={1} minWidth={0} gap={2}>
          <XStack gap="2" alignItems="center">
            <PlainText fontSize={15} fontWeight="600" numberOfLines={1} flexShrink={1}>
              {row.title}
            </PlainText>
            {row.kind === 'agent' && row.working ? (
              <YStack borderWidth={1} borderColor="primary" paddingHorizontal={4}>
                <PlainText fontFamily="mono" fontSize={9} letterSpacing={1.2} textTransform="uppercase" color="primary">
                  Busy
                </PlainText>
              </YStack>
            ) : null}
          </XStack>
          <PlainText fontSize={12} color="dim">
            {row.line}
          </PlainText>
        </YStack>
      </XStack>
    </RowFrame>
  );
}

function Face({ agentId }: { agentId: string }) {
  const look = useAgentLook(agentId);
  return <AgentFace mood={look.mood} mascot={look.mascot} size={18} />;
}

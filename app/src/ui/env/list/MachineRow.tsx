import { XStack, YStack } from 'tamagui';
import type { Agent, AgentId } from '../../../engine/agents/records';
import type { Image, ImageId } from '../../../engine/linux/types';
import { useRoom } from '../../common/desk/useDesk';
import OpenMark from '../../common/OpenMark';
import PlainText from '../../common/PlainText';
import { ROW_GUTTER } from '../../common/rows/place';
import { useOpening } from '../../nav/opening';
import { formatBytes } from '../logic/format';
import { machineLine } from '../logic/sharedMachineText';
import ImageStatus from '../parts/ImageStatus';
import AgentLine, { LineBody } from './AgentLine';

type Props = {
  image: Image | null;
  agents: Agent[];
  onOpen: (agentId: string) => void;
  /** Opens the machine's own page; absent on that page. */
  onOpenMachine?: (imageId: ImageId) => void;
  /** The agent the page was opened from: marked as this agent, not opened. */
  here?: AgentId | null;
  /** Each running agent's activity (Working or Idle), on the machine's page. */
  idle?: Record<AgentId, boolean | null>;
  /** Its setup state under its agents; false where the page shows it already. */
  status?: boolean;
};

// One machine in a list of agents, a row of the list's group (no box of
// its own), the same on its system's page and on its own page: a line with
// what it is, its room and size ("Shared machine · room 1 · 1.2 GB"; a
// tap opens the machine's page), then each agent on it (AgentLine), then
// its setup state while it is not ready. A machine without an agent (a
// setup cut short) says so; its page deletes it.
export default function MachineRow({ image, agents, onOpen, onOpenMachine, here = null, idle, status = true }: Props) {
  const room = useRoom(image?.id);
  const size = image && image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
  const line = image ? machineLine(agents.length, room, size) : 'Missing machine';
  const openMachine = image && onOpenMachine ? () => onOpenMachine(image.id) : null;

  return (
    <YStack>
      <MachineHead text={line} onOpen={openMachine} />
      {agents.map((a) => (
        <AgentLine
          key={a.id}
          agent={a}
          missing={image == null}
          idle={idle?.[a.id] ?? null}
          onOpen={a.id === here ? null : onOpen}
        />
      ))}
      {agents.length === 0 ? (
        <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="2">
          <LineBody
            lead={<YStack width={25} height={25} borderWidth={1} borderColor="faint" />}
            title="No agent"
            sub="A setup cut short left it behind"
            trailing={null}
          />
        </YStack>
      ) : null}
      {status && image && image.state !== 'ready' ? (
        <YStack paddingHorizontal={ROW_GUTTER} paddingBottom="2">
          <ImageStatus image={image} />
        </YStack>
      ) : null}
    </YStack>
  );
}

// The machine's line over its agents, in amber caps; with a page to open,
// a tap opens it (a spinner for the › until it is in).
function MachineHead({ text, onOpen }: { text: string; onOpen: (() => void) | null }) {
  const open = useOpening(onOpen ?? undefined);
  return (
    <XStack
      paddingHorizontal={ROW_GUTTER}
      paddingTop="2"
      paddingBottom={onOpen ? '2' : '1'}
      alignItems="center"
      gap="2"
      backgroundColor={onOpen ? 'press:panel2' : undefined}
      onPress={open.press}
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={onOpen ? `${text}: open the machine` : text}
    >
      <YStack flex={1} minWidth={0}>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
          {text}
        </PlainText>
      </YStack>
      {onOpen ? (
        <YStack flexShrink={0} paddingRight="1" opacity={0.5}>
          <OpenMark opening={open.opening} size={18} />
        </YStack>
      ) : null}
    </XStack>
  );
}

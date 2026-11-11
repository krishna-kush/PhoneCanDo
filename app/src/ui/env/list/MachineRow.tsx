import { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import type { Image } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { deleteUnusedImage } from '../../../state/flows/deleteAgentAndImage';
import ArrowIcon from '../../common/ArrowIcon';
import CardMenu from '../../common/CardMenu';
import ConfirmDialog from '../../common/ConfirmDialog';
import AgentFace from '../../common/face/AgentFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import { useTheme } from '../../common/globals';
import { usePageActive } from '../../nav/pageActive';
import { engineStateWord } from '../logic/engineState';
import { linuxFailureText } from '../logic/errorText';
import { formatBytes } from '../logic/format';
import ImageStatus from '../parts/ImageStatus';
import Note from '../parts/Note';

type Props = { image: Image | null; agent: Agent | null; onOpen: (agentId: string) => void };

// One machine in its system's agent list: the agent's face, name and
// engine's word, and the image's setup state while it is not ready. A row
// of the list's group (no box of its own). Tap opens the agent page. A
// machine without an agent (a setup cut short) can only be deleted.
export default function MachineRow({ image, agent, onOpen }: Props) {
  const t = useTheme();
  const status = useAgentsStore((s) => (agent ? s.statuses[agent.id] : undefined));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const size = image && image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
  const sub = agent
    ? [image ? engineStateWord(status?.state) : 'Its machine is missing', size].filter(Boolean).join(' · ')
    : ['Unused machine', size].filter(Boolean).join(' · ');

  return (
    <YStack
      paddingHorizontal="3"
      paddingVertical="2"
      gap="2"
      backgroundColor={agent ? `press:${t.panel2}` : undefined}
      onPress={agent ? () => onOpen(agent.id) : undefined}
      accessibilityRole={agent ? 'button' : undefined}
      accessibilityLabel={agent ? `${agent.name}, ${sub}` : undefined}
    >
      <XStack alignItems="center" gap="3" minHeight={40}>
        {agent ? <RowFace agentId={agent.id} /> : <YStack width={25} height={25} borderWidth={1} borderColor={t.faint} />}
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="600" numberOfLines={1} ellipsizeMode="tail">
            {agent?.name ?? 'No agent'}
          </Text>
          <Text fontFamily="mono" fontSize={12} color={t.dim} numberOfLines={1}>
            {sub}
          </Text>
        </YStack>
        {agent ? (
          <YStack flexShrink={0} paddingRight="1" opacity={0.5}>
            <ArrowIcon dir="right" size={18} />
          </YStack>
        ) : image ? (
          <CardMenu
            label="Actions for this unused machine"
            items={[{ label: 'Delete machine', danger: true, onSelect: () => setConfirmDelete(true) }]}
          />
        ) : null}
      </XStack>
      {image && image.state !== 'ready' ? <ImageStatus image={image} /> : null}
      {error ? <Note tone="error">{error}</Note> : null}
      {image && !agent ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Delete this machine?"
          message="No agent uses it: a setup that was cut short left it behind."
          onConfirm={() => {
            setConfirmDelete(false);
            setError(null);
            deleteUnusedImage(image.id).catch((e: unknown) => setError(linuxFailureText(e)));
          }}
        />
      ) : null}
    </YStack>
  );
}

// Still while another page covers this one.
function RowFace({ agentId }: { agentId: string }) {
  const look = useAgentLook(agentId);
  const active = usePageActive();
  return <AgentFace mood={look.mood} pose={look.pose} size={18} still={!active} />;
}

import { useState } from 'react';
import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import type { Image } from '../../../engine/linux/types';
import { deleteUnusedImage } from '../../../state/flows/deleteAgentAndImage';
import CardMenu from '../../common/CardMenu';
import ConfirmDialog from '../../common/ConfirmDialog';
import PlainText from '../../common/PlainText';
import { linuxFailureText } from '../logic/errorText';
import { formatBytes } from '../logic/format';
import { sharedMachineLine } from '../logic/sharedMachineText';
import ImageStatus from '../parts/ImageStatus';
import Note from '../parts/Note';
import AgentLine, { LineBody } from './AgentLine';

type Props = { image: Image | null; agents: Agent[]; onOpen: (agentId: string) => void };

// One machine in its system's agent list, a row of the list's group (no box
// of its own): its agent (AgentLine) with the machine's size, or, on a
// machine agents share, a line saying so with its size over each of its
// agents, so the size shows once; then the image's setup state while it is
// not ready. A machine without an agent (a setup cut short) can only be
// deleted.
export default function MachineRow({ image, agents, onOpen }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const size = image && image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
  const below = (
    <>
      {image && image.state !== 'ready' ? <ImageStatus image={image} /> : null}
      {error ? <Note tone="error">{error}</Note> : null}
    </>
  );

  if (agents.length > 1) {
    return (
      <YStack paddingTop="2">
        <YStack paddingHorizontal="3">
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
            {sharedMachineLine(size)}
          </PlainText>
        </YStack>
        {agents.map((a) => (
          <AgentLine key={a.id} agent={a} missing={image == null} size={null} onOpen={onOpen} />
        ))}
        {image && image.state !== 'ready' ? (
          <YStack paddingHorizontal="3" paddingBottom="2">
            <ImageStatus image={image} />
          </YStack>
        ) : null}
      </YStack>
    );
  }

  if (agents.length === 1) {
    return (
      <AgentLine agent={agents[0]} missing={image == null} size={size} onOpen={onOpen}>
        {below}
      </AgentLine>
    );
  }

  return (
    <YStack paddingHorizontal="3" paddingVertical="2" gap="2">
      <LineBody
        lead={<YStack width={25} height={25} borderWidth={1} borderColor="faint" />}
        title="No agent"
        sub={['Unused machine', size].filter(Boolean).join(' · ')}
        trailing={
          image ? (
            <CardMenu
              label="Actions for this unused machine"
              items={[{ label: 'Delete machine', danger: true, onSelect: () => setConfirmDelete(true) }]}
            />
          ) : null
        }
      />
      {below}
      {image ? (
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

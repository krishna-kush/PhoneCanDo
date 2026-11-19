import { Text, XStack, YStack } from 'tamagui';
import type { AgentId } from '../../engine/agents/records';
import DeckKeys from './actions/DeckKeys';
import AgentFace from './face/AgentFace';
import { DESK_LOOK } from './slip/desk';
import SlipDialog from './slip/SlipDialog';
import SweatFace from './slip/SweatFace';

/** Faces drawn by the title when it deletes agents; more just make the row long. */
const MAX_FACES = 3;

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  /** The button that only closes it, when "Cancel" says too little (the choice it leaves you with). */
  cancelLabel?: string;
  /** A delete or a restart, which can't be undone; primary for a way on that undoes nothing. */
  confirmVariant?: 'danger' | 'primary';
  /** The agents it would delete: their own faces sweat by the title, in place of the front desk's. */
  agentIds?: readonly AgentId[];
  onConfirm: () => void;
};

// Centered confirm dialog (not a bottom sheet), used for every
// delete/remove confirm and for a choice worth a second look (sharing a
// machine), so they all look and behave identically. One that can't be
// undone has hazard tape across its top and the front desk (A-04, slip/
// desk.ts) sweating by its title (deleting agents, their own faces
// instead), its keys a way back and, under the "can't be undone" rule, the
// act; a calm one is plain, its act the main key. A tap on the dim or
// Android back closes it.
export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  agentIds = [],
  onConfirm,
}: Props) {
  const danger = confirmVariant === 'danger';
  const faces = agentIds.slice(0, MAX_FACES);
  return (
    <SlipDialog open={open} onClose={onClose} scrimCloses hazard={danger}>
      <XStack alignItems="center" gap="3">
        {danger && faces.length > 0 ? (
          <XStack gap="2">
            {faces.map((id) => (
              <SweatFace key={id} agentId={id} size={faces.length > 1 ? 24 : 30} />
            ))}
          </XStack>
        ) : danger ? (
          <AgentFace mood="sweaty" mascot={DESK_LOOK} size={30} />
        ) : null}
        <YStack flex={1}>
          <Text fontSize={19} fontWeight="700">
            {title}
          </Text>
        </YStack>
      </XStack>
      {message ? (
        <Text fontSize={15} color="color10">
          {message}
        </Text>
      ) : null}
      <DeckKeys
        actions={[
          { label: confirmLabel, role: danger ? 'danger' : 'go', onPress: onConfirm },
          { label: cancelLabel, role: 'back', onPress: onClose },
        ]}
      />
    </SlipDialog>
  );
}

import { Text, YStack } from 'tamagui';
import type { Agent } from '../../engine/agents/records';
import { useAppStore } from '../../state/app';
import { useLinuxStore } from '../../state/linux';
import ActionDeck from '../common/actions/ActionDeck';
import { kindGoneText } from '../env/logic/kindGone';
import Note from '../env/parts/Note';

// Home of an agent whose kind this build no longer ships (an older build
// made it; the kind was dropped since). It can't start, so there is no UI
// of its own: why, a terminal in its machine (where its program may still
// be installed), the custom agent form, to add it back as your own, and
// its page, to delete it.
export default function KindGoneHome({ agent }: { agent: Agent }) {
  const push = useAppStore((s) => s.push);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const image = useLinuxStore((s) => s.images.find((i) => i.id === agent.imageId));
  return (
    <YStack flex={1} backgroundColor="bg" padding="4" gap="3" justifyContent="center">
      <Text color="primary" fontFamily="mono">
        {`${agent.kind} is no longer included`}
      </Text>
      <Note>{kindGoneText(agent.kind)}</Note>
      <ActionDeck
        barcode="deckKindGone"
        actions={[
          { label: 'Add it as a custom agent', role: 'go', mark: 'add', onPress: () => push({ name: 'custom-agent', kindId: null }) },
          {
            label: 'Open terminal in its machine',
            disabled: image?.state !== 'ready',
            onPress: () => openLinuxTerminal(agent.id),
          },
          { label: 'Agent settings', onPress: () => push({ name: 'agent', agentId: agent.id }) },
        ]}
      />
    </YStack>
  );
}

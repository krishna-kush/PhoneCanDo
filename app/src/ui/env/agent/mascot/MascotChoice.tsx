import { YStack } from 'tamagui';
import type { Look } from '../../../../../../mascot/look.ts';
import AgentFace from '../../../common/face/AgentFace';
import PlainText from '../../../common/PlainText';

type Props = { label: string; mascot: Look; selected: boolean; onSelect: () => void };

// One choice on the Mascot page: the face as it would look, still, and its
// name under it; the chosen one framed in red.
export default function MascotChoice({ label, mascot, selected, onSelect }: Props) {
  return (
    <YStack
      width={76}
      alignItems="center"
      gap="1"
      paddingVertical="2"
      paddingHorizontal="1"
      borderWidth={1}
      borderColor={selected ? 'primary' : 'line'}
      backgroundColor="panel"
      opacity="1 press:0.9"
      scale="press:0.98"
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <AgentFace mood="awake" mascot={mascot} size={28} still />
      <PlainText fontSize={12} numberOfLines={1} color={selected ? 'primary' : 'muted'}>
        {label}
      </PlainText>
    </YStack>
  );
}

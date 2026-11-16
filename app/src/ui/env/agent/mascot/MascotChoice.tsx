import { useState } from 'react';
import { YStack } from 'tamagui';
import type { Look } from '../../../../../../mascot/look.ts';
import AgentFace from '../../../common/face/AgentFace';
import StillFace from '../../../common/face/StillFace';
import PlainText from '../../../common/PlainText';

export type ChoiceProps = {
  label: string;
  mascot: Look;
  selected: boolean;
  onSelect: () => void;
  /** The face's short side in dp. */
  size?: number;
  /** Its number on the rack, small in the top corner. */
  number?: string;
  /** Not earned yet: faded, in a dashed frame, and it never hops. */
  locked?: boolean;
  /** Read out instead of the label. */
  accessibilityLabel?: string;
  /** Out of sight: the chosen one stands still too. */
  still?: boolean;
};

// One choice on the Mascot page, as wide as its row gives it: the face as it
// would look and its name under it. The chosen one is framed in red on an
// amber shadow, as the logo stands, and awake (it blinks); a tap makes the
// face hop as it is put on. The rest are still faces, which cost next to
// nothing, so a page of them opens at once.
export default function MascotChoice({
  label,
  mascot,
  selected,
  onSelect,
  size = 28,
  number,
  locked = false,
  accessibilityLabel,
  still = false,
}: ChoiceProps) {
  const [hop, setHop] = useState(0);
  const press = () => {
    if (!locked) setHop((n) => n + 1);
    onSelect();
  };
  return (
    <YStack
      flex={1}
      minWidth={0}
      alignItems="center"
      gap="1"
      paddingTop="3"
      paddingBottom="2"
      paddingHorizontal={2}
      borderWidth={1}
      borderStyle={locked ? 'dashed' : 'solid'}
      borderColor={selected ? 'primary' : locked ? 'lineStrong' : 'line'}
      backgroundColor={selected ? 'primarySoft' : 'panel'}
      boxShadow={selected ? '2px 2px 0 secondary' : undefined}
      opacity="1 press:0.9"
      scale="press:0.96"
      onPress={press}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {number ? (
        <YStack position="absolute" top={3} left={5}>
          <PlainText fontFamily="mono" fontSize={9} color={selected ? 'primary' : 'faint'}>
            {number}
          </PlainText>
        </YStack>
      ) : null}
      <YStack opacity={locked ? 0.3 : 1}>
        {selected ? (
          <AgentFace mood="awake" mascot={mascot} size={size} hop={hop} still={still} />
        ) : (
          <StillFace mood="awake" mascot={mascot} size={size} />
        )}
      </YStack>
      <PlainText fontSize={11} numberOfLines={1} color={selected ? 'primary' : locked ? 'faint' : 'muted'}>
        {label}
      </PlainText>
    </YStack>
  );
}

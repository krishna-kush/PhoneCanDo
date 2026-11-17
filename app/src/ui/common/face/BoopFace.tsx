import { type ComponentProps, useState } from 'react';
import { YStack } from 'tamagui';
import AgentFace from './AgentFace';

type Props = ComponentProps<typeof AgentFace> & {
  /** What a screen reader hears: who it is, ending in "Tap it." */
  label: string;
  /** Each tap, with how many so far (a caption, a jackpot, a wake-up). */
  onBoop?: (boops: number) => void;
  hitSlop?: number;
};

// A face you can boop: each tap makes it hop, the way A-01 and an agent's
// face answer a tap on every page, and `onBoop` hears the count. The rest
// of its props are AgentFace's; its own `hop` (a pick, say) hops it too.
export default function BoopFace({ label, onBoop, hitSlop = 12, hop = 0, ...face }: Props) {
  const [boops, setBoops] = useState(0);
  const boop = () => {
    const n = boops + 1;
    setBoops(n);
    onBoop?.(n);
  };
  return (
    <YStack onPress={boop} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel={label}>
      <AgentFace {...face} hop={hop + boops} />
    </YStack>
  );
}

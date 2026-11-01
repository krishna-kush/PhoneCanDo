import { Button } from 'tamagui';
import PlusIcon from './PlusIcon';
import { HIT } from './globals';

type Props = {
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

// 64dp rounded-square floating action button (bottom-right). The plus is a
// vector icon (not "+" text) so it stays sharp and centered. Replaces the
// scattered inline FABs so size/position stay consistent.
export default function FAB({ label = '+', onPress, accessibilityLabel }: Props) {
  return (
    <Button
      position="absolute"
      bottom="$5"
      right="$4"
      width={HIT.fabSize}
      height={HIT.fabSize}
      borderRadius={0}
      paddingHorizontal={0}
      justifyContent="center"
      alignItems="center"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      pressStyle={{ opacity: 0.9, scale: 0.96 }}
    >
      <PlusIcon />
    </Button>
  );
}

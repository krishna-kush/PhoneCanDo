import { Button } from 'tamagui';
import { HIT } from './globals';

type Props = {
  label: string;
  onPress: () => void;
  danger?: boolean;
};

// One popover row for every menu (header ⋮ and per-row ⋮). Mono like every
// button label; only the destructive colour and the shared type treatment
// live here. A press darkens the row without dimming it, as on Tamagui 2.
export default function MenuItem({ label, onPress, danger }: Props) {
  return (
    <Button
      minHeight={HIT.minTouch}
      paddingHorizontal="4"
      borderRadius={0}
      fontFamily="mono"
      fontSize={13}
      fontWeight="400"
      letterSpacing={0.8}
      ellipsis
      textProps={{ textTransform: 'uppercase' }}
      variant="quiet"
      opacity="1 press:1"
      justifyContent="flex-start"
      color={danger ? 'primary' : undefined}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

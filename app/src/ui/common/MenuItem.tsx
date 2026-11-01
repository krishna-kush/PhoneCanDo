import { Button } from 'tamagui';
import { HIT, useTheme } from './globals';

type Props = {
  label: string;
  onPress: () => void;
  danger?: boolean;
};

// One popover row for every menu (header ⋮ and per-row ⋮). The mono family
// comes from the Button default in tamagui.config.ts; only the destructive
// colour and the shared type treatment live here.
export default function MenuItem({ label, onPress, danger }: Props) {
  const t = useTheme();
  return (
    <Button
      minHeight={HIT.minTouch}
      borderRadius={0}
      fontSize={13}
      letterSpacing={0.8}
      textProps={{ textTransform: 'uppercase' }}
      chromeless
      justifyContent="flex-start"
      color={danger ? t.primary : undefined}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

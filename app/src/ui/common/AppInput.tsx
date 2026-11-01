import { Input } from 'tamagui';
import type { ComponentProps } from 'react';
import { HIT, useTheme } from './globals';

type Props = ComponentProps<typeof Input>;

// Single text field used everywhere. 52dp tall with a 17sp font so it is
// thumb-friendly and readable. Square hairline surface, matching the site.
export default function AppInput(props: Props) {
  const t = useTheme();
  return (
    <Input
      minHeight={HIT.inputH}
      fontSize={17}
      borderRadius={0}
      borderWidth={1}
      borderColor={t.lineStrong}
      backgroundColor={t.panel}
      color={t.fg}
      placeholderTextColor="$color10"
      paddingHorizontal="$4"
      autoCapitalize="none"
      {...props}
    />
  );
}

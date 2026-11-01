import type { ReactNode } from 'react';
import { Button } from 'tamagui';
import { HIT, useTheme } from './globals';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  flex?: number;
  accessibilityState?: { selected?: boolean };
};

// The site's `.btn`: square, mono uppercase, 2px hard amber offset. Keeps
// the 52dp target and 17sp input text — only the surface language changed.
export default function AppButton({
  children,
  onPress,
  variant = 'primary',
  disabled,
  flex,
  accessibilityState,
}: Props) {
  const t = useTheme();
  const style =
    variant === 'secondary'
      ? { backgroundColor: 'transparent', borderColor: t.lineStrong, color: t.fg }
      : variant === 'ghost'
        ? { backgroundColor: 'transparent', borderWidth: 0, color: t.fg }
        : { backgroundColor: t.primary, borderColor: t.primary, color: t.onPrimary };

  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      flex={flex}
      accessibilityState={accessibilityState}
      minHeight={HIT.buttonH}
      paddingHorizontal="$4"
      paddingVertical="$3"
      borderRadius={0}
      borderWidth={1}
      fontSize={12}
      fontWeight="600"
      letterSpacing={1.2}
      textProps={{ textTransform: 'uppercase' }}
      elevation={0}
      boxShadow={variant === 'ghost' ? undefined : `2px 2px 0 ${t.secondary}`}
      opacity={disabled ? 0.5 : 1}
      pressStyle={{ opacity: 0.85, scale: 0.98 }}
      {...style}
    >
      {children}
    </Button>
  );
}

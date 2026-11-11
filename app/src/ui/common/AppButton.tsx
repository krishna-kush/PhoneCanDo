import type { ReactNode } from 'react';
import { Button } from 'tamagui';
import { HIT, useTheme } from './globals';
import LogoLoader from './LogoLoader';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Busy state: disabled, outlined, with the small logo loader before the
      label (the loader's red needs a non-red surface to read). */
  loading?: boolean;
  flex?: number;
  accessibilityState?: { selected?: boolean };
};

// The site's `.btn`: square, mono uppercase, 2px hard amber offset. Keeps
// the 52dp target and 17sp input text — only the surface language changed.
// A press sinks the button into its shadow (the site's :active), so it
// clicks like a key; a ghost button only dims.
export default function AppButton({
  children,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  flex,
  accessibilityState,
}: Props) {
  const t = useTheme();
  // A press also clears the border, as Tamagui 2's Button did.
  const style =
    variant === 'secondary' || loading
      ? { backgroundColor: 'transparent', borderColor: `${t.lineStrong} press:transparent`, color: t.fg }
      : variant === 'ghost'
        ? { backgroundColor: 'transparent', borderWidth: 0, color: t.fg }
        : { backgroundColor: t.primary, borderColor: `${t.primary} press:transparent`, color: t.onPrimary };
  const sinks = variant !== 'ghost';
  const opacity = disabled && !loading ? 0.5 : 1;

  return (
    <Button
      onPress={onPress}
      disabled={disabled || loading}
      icon={loading ? <LogoLoader size={9} /> : undefined}
      flex={flex}
      accessibilityState={accessibilityState}
      minHeight={HIT.buttonH}
      paddingHorizontal="4"
      paddingVertical="3"
      gap={9}
      borderRadius={0}
      borderWidth={1}
      fontFamily="mono"
      fontSize={12}
      fontWeight="600"
      letterSpacing={1.2}
      ellipsis
      textProps={{ textTransform: 'uppercase' }}
      boxShadow={sinks ? `2px 2px 0 ${t.secondary} press:0px 0px 0 ${t.secondary}` : undefined}
      x={sinks ? 'press:2' : undefined}
      y={sinks ? 'press:2' : undefined}
      opacity={`${opacity} press:${sinks ? opacity : 0.7}`}
      {...style}
    >
      {children}
    </Button>
  );
}

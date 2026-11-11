import { XStack } from 'tamagui';
import { HIT } from './globals';
import LogoLoader from './LogoLoader';
import PlainText from './PlainText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  /** The label, text only (it is drawn as PlainText). */
  children: string;
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
//
// Drawn as one Tamagui frame and a PlainText label rather than Tamagui's
// Button (a theme, a wrapper, a context, a frame and a styled label per
// button, on every page). The props below give the same views Button gave:
// its frame defaults (row, centred, solid border, auto width, focus
// outline), its md label (20px line, no grow, no select) and its disabled
// state (no press, no focus, opacity ours).
export default function AppButton({
  children,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  flex,
  accessibilityState,
}: Props) {
  // A press also clears the border, as Tamagui 2's Button did.
  const outlined = variant === 'secondary' || loading;
  const ghost = !outlined && variant === 'ghost';
  const sinks = variant !== 'ghost';
  const off = disabled || loading;
  const opacity = disabled && !loading ? 0.5 : 1;

  return (
    <XStack
      role="button"
      aria-disabled={!!off}
      tabIndex={off ? -1 : 0}
      pointerEvents={off ? 'none' : undefined}
      onPress={off ? undefined : onPress}
      flex={flex}
      accessibilityState={accessibilityState}
      alignItems="center"
      justifyContent="center"
      flexWrap="nowrap"
      width="auto"
      minHeight={HIT.buttonH}
      paddingHorizontal="4"
      paddingVertical="3"
      gap={9}
      borderRadius={0}
      borderStyle="solid"
      borderWidth={ghost ? 0 : 1}
      borderColor={outlined ? 'lineStrong press:transparent' : ghost ? 'transparent' : 'primary press:transparent'}
      backgroundColor={outlined || ghost ? 'transparent' : 'primary'}
      boxShadow={sinks ? '2px 2px 0 secondary press:0px 0px 0 secondary' : undefined}
      x={sinks ? 'press:2' : undefined}
      y={sinks ? 'press:2' : undefined}
      opacity={`${opacity} press:${sinks ? opacity : 0.7}`}
      outlineColor="focus-visible:outline-color"
      outlineStyle="focus-visible:solid"
      outlineWidth="focus-visible:2px"
    >
      {loading ? <LogoLoader size={9} /> : null}
      <PlainText
        fontFamily="mono"
        fontSize={12}
        lineHeight="20px"
        fontWeight="600"
        letterSpacing={1.2}
        textTransform="uppercase"
        userSelect="none"
        flexGrow={0}
        flexShrink={1}
        color={outlined || ghost ? 'fg' : 'onPrimary'}
      >
        {children}
      </PlainText>
    </XStack>
  );
}

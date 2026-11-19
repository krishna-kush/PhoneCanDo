import Svg, { Path } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import { HIT, useTheme } from '../globals';
import LogoLoader from '../LogoLoader';
import Spot from '../spot/Spot';
import Hazard from './Hazard';
import KeyFace from './KeyFace';
import KeyGlyph from './KeyGlyph';
import type { DeckRole } from './logic/deal';
import type { DeckAction } from './types';

// One key of a deck (ActionDeck): the main one red and tall with its
// glyph in a little window, the others outlined on the page's colour, Cancel's
// border dashed, Delete's edged in hazard tape. Keys with a hard amber
// shadow sink into it as pressed, like AppButton's.
export default function DeckKey({ action, flex }: { action: DeckAction; flex?: number }) {
  const t = useTheme();
  const role: DeckRole = action.role ?? 'more';
  const off = action.disabled || action.loading;
  // A busy main key goes outlined: the loader's red needs a non-red face.
  const filled = role === 'go' && !action.loading;
  const sinks = role !== 'back';
  const shadow = role === 'danger' ? 'primary' : 'secondary';
  const opacity = action.disabled && !action.loading ? 0.5 : 1;

  return (
    <YStack flex={flex}>
      <Spot id={action.spot ?? null}>
        <XStack
          role="button"
          aria-label={action.label}
          aria-disabled={!!off}
          pointerEvents={off ? 'none' : undefined}
          onPress={off ? undefined : action.onPress}
          alignItems="center"
          gap="3"
          minHeight={role === 'go' ? 58 : HIT.buttonH}
          paddingLeft={role === 'danger' ? 22 : 14}
          paddingRight={role === 'danger' ? 22 : 14}
          overflow="hidden"
          borderWidth={1}
          borderStyle={role === 'back' ? 'dashed' : 'solid'}
          borderColor={filled ? 'primary' : role === 'danger' ? 'primary' : 'lineStrong'}
          backgroundColor={filled ? 'primary' : role === 'back' ? 'transparent' : 'bg'}
          boxShadow={sinks ? `${role === 'go' ? 3 : 2}px ${role === 'go' ? 3 : 2}px 0 ${shadow} press:0px 0px 0 ${shadow}` : undefined}
          x={sinks ? `press:${role === 'go' ? 3 : 2}` : undefined}
          y={sinks ? `press:${role === 'go' ? 3 : 2}` : undefined}
          opacity={`${opacity} press:${sinks ? opacity : 0.6}`}
        >
          {role === 'danger' ? (
            <>
              <YStack position="absolute" left={0} top={0} bottom={0} width={10}>
                <Hazard />
              </YStack>
              <YStack position="absolute" right={0} top={0} bottom={0} width={10}>
                <Hazard />
              </YStack>
            </>
          ) : null}
          {role === 'go' ? (
            <YStack
              width={26}
              height={26}
              alignItems="center"
              justifyContent="center"
              borderWidth={1}
              borderColor={filled ? 'onPrimary' : 'lineStrong'}
            >
              {action.loading ? <LogoLoader size={9} /> : <KeyGlyph role="go" color={t.onPrimary} size={11} />}
            </YStack>
          ) : null}
          <XStack flex={1} alignItems="center" gap="2" justifyContent={role === 'go' ? 'flex-start' : 'center'}>
            <KeyFace
              label={action.label}
              role={role}
              ink={filled ? 'onPrimary' : role === 'danger' ? 'primary' : role === 'back' ? 'dim' : 'fg'}
              glyphInk={role === 'more' ? 'secondaryInk' : undefined}
              loading={role === 'go' ? false : action.loading}
              bare={role === 'go'}
              big={role === 'go'}
            />
          </XStack>
          {role === 'go' ? <Chevrons color={filled ? t.onPrimary : t.dim} /> : null}
        </XStack>
      </Spot>
    </YStack>
  );
}

// Three chevrons fading off the main key's right end, as a sign that points on.
function Chevrons({ color }: { color: string }) {
  return (
    <Svg width={24} height={12} viewBox="0 0 24 12">
      {[0.35, 0.65, 1].map((o, i) => (
        <Path key={o} d={`M${2 + i * 8} 1 L${7 + i * 8} 6 L${2 + i * 8} 11`} stroke={color} strokeWidth={2} fill="none" opacity={o} />
      ))}
    </Svg>
  );
}

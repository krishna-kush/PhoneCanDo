import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import type { ThemeMode } from '../../../state/app';
import tokens from '../../../../../theme/tokens.json';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import { moodOf, type Scheme, THEME_LABEL } from './copy';

type Props = {
  mode: ThemeMode;
  /** The phone's own scheme now, which System follows. */
  phone: Scheme;
  picked: boolean;
  /** Tapped, at this point of the window (where the new theme's colour opens from). */
  onPick: (x: number, y: number) => void;
  /** Out of sight: A-01 holds still. */
  still: boolean;
};

// How far a screen stands off its hard shadow, and sinks into it while pressed (AppButton's).
const LIFT = 2;
const SCREEN_H = 104;

// One theme as a little phone screen in that theme's own palette (System
// cut corner to corner, light over dark), a kicker and two lines of text
// at its top and A-01 at its foot: up in the light, napping in the dark.
// The screens stand on a hard shadow like keys and sink into it while
// held, as a button does; the picked one stands on red instead of amber,
// in a red frame, and A-01 hops as it is picked.
export default function ThemeScreen({ mode, phone, picked, onPick, still }: Props) {
  const [hops, setHops] = useState(0);
  const was = useRef(picked);
  useEffect(() => {
    if (picked && !was.current) setHops((n) => n + 1);
    was.current = picked;
  }, [picked]);
  // Its header and lines sit on its top-left corner: System's is the light half.
  const ink = tokens[mode === 'dark' ? 'dark' : 'light'];

  return (
    <YStack flex={1} gap="2" minWidth={0}>
      <YStack
        height={SCREEN_H}
        marginRight={LIFT}
        marginBottom={LIFT}
        borderWidth={1}
        borderColor={picked ? 'primary' : 'lineStrong'}
        overflow="hidden"
        x={picked ? undefined : 'press:2'}
        y={picked ? undefined : 'press:2'}
        boxShadow={picked ? '2px 2px 0 primary' : '2px 2px 0 secondary press:0px 0px 0 secondary'}
        onPress={picked ? undefined : (e) => onPick(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        accessibilityRole="radio"
        accessibilityState={{ checked: picked }}
        accessibilityLabel={`${THEME_LABEL[mode]} theme`}
      >
        <Paper mode={mode} />
        <View style={{ position: 'absolute', left: 8, top: 8, right: 8, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 4, height: 4, backgroundColor: ink.primary }} />
            <View style={{ width: 18, height: 2, backgroundColor: ink.secondary }} />
          </View>
          <View style={{ width: '72%', height: 3, backgroundColor: ink.fg, opacity: 0.55 }} />
          <View style={{ width: '46%', height: 3, backgroundColor: ink.fg, opacity: 0.3 }} />
        </View>
        <YStack position="absolute" left={0} right={0} bottom={10} alignItems="center">
          <AgentFace mood={moodOf(mode, phone)} size={22} hop={hops} still={still} />
        </YStack>
      </YStack>
      <XStack alignItems="center" gap="2" paddingLeft={2}>
        <YStack width={6} height={6} backgroundColor={picked ? 'primary' : 'lineStrong'} />
        <PlainText fontFamily="mono" fontSize={11} fontWeight="600" letterSpacing={1.4} textTransform="uppercase" color={picked ? 'fg' : 'dim'}>
          {THEME_LABEL[mode]}
        </PlainText>
      </XStack>
    </YStack>
  );
}

// The screen's background in its own palette; System's is light in the
// top-left half and dark in the bottom-right, cut corner to corner.
function Paper({ mode }: { mode: ThemeMode }) {
  if (mode !== 'system') return <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: tokens[mode].bg }} />;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Rect x={0} y={0} width={100} height={100} fill={tokens.light.bg} />
        <Polygon points="100,0 100,100 0,100" fill={tokens.dark.bg} />
      </Svg>
    </View>
  );
}

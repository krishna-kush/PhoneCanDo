import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { XStack } from 'tamagui';
import { HIT, type Theme, useTheme } from '../../../common/globals';
import PlainText from '../../../common/PlainText';
import { useReduceMotion } from '../../../common/useReduceMotion';
import type { WhenKind } from '../../logic/draft';
import { WHEN_WORDS } from '../../logic/editorCopy';

const KINDS: readonly WhenKind[] = ['once', 'every', 'daily'];

// A slide with a little overshoot, as a lever thrown into its notch.
const THROW = { damping: 14, stiffness: 260 };

type Props = { value: WhenKind; onPick: (when: WhenKind) => void };

// Once, every or daily as a three-way lever: a red block slides under the
// words, and the words it covers turn white as it passes (a white copy of
// the row, cut to the block). One of three, as a radio group.
export default function KindSwitch({ value, onPick }: Props) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const at = KINDS.indexOf(value);
  const slot = useSharedValue(0);
  const place = useSharedValue(at);

  useEffect(() => {
    place.value = reduce ? at : withSpring(at, THROW);
  }, [at, reduce, place]);

  const block = useAnimatedStyle(() => ({
    width: slot.value,
    transform: [{ translateX: place.value * slot.value }],
  }));
  const inked = useAnimatedStyle(() => ({
    width: slot.value * KINDS.length,
    transform: [{ translateX: -place.value * slot.value }],
  }));

  return (
    <XStack
      height={HIT.minTouch}
      borderWidth={1}
      borderColor="lineStrong"
      backgroundColor="bg"
      onLayout={(e) => {
        slot.value = (e.nativeEvent.layout.width - 2) / KINDS.length;
      }}
      accessibilityRole="radiogroup"
    >
      {KINDS.map((kind) => (
        <XStack
          key={kind}
          flex={1}
          alignItems="center"
          justifyContent="center"
          onPress={() => onPick(kind)}
          accessibilityRole="radio"
          accessibilityState={{ checked: kind === value }}
          accessibilityLabel={WHEN_WORDS[kind]}
        >
          <Word kind={kind} color="fg" />
        </XStack>
      ))}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden', backgroundColor: t.primary }, block]}
      >
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row' }, inked]}>
          {KINDS.map((kind) => (
            <View key={kind} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Word kind={kind} color="onPrimary" />
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </XStack>
  );
}

function Word({ kind, color }: { kind: WhenKind; color: keyof Theme }) {
  return (
    <PlainText fontFamily="mono" fontSize={12} fontWeight="600" letterSpacing={1.4} textTransform="uppercase" color={color}>
      {WHEN_WORDS[kind]}
    </PlainText>
  );
}

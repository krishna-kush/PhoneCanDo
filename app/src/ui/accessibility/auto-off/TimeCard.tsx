import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import Stamp from '../../common/Stamp';
import { useReduceMotion } from '../../common/useReduceMotion';
import { CARD_NO, CARD_TITLE, cardLines, cardStamp } from './copy';

type Props = {
  /** Auto off: the OUT line punched and the AUTO stamp across the card. */
  on: boolean;
};

const HOLE = 14;

// IN is always punched: that is how A-01 clocks in.
const PUNCHED = new Animated.Value(1);

// A-01's time card, how Auto off works at a glance: IN when you switch
// Accessibility on, OUT when no agent needs the phone and PhoneCanDo is in
// the background (punched while Auto off is on; by hand otherwise). Each
// change punches it: the hole fills with a pop, the card jolts down in the
// clock, and its stamp slams anew. It lies a little askew, a card on a
// desk.
export default function TimeCard({ on }: Props) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const punch = useRef(new Animated.Value(on ? 1 : 0)).current;
  const jolt = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  const [slam, setSlam] = useState(false);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSlam(true);
    if (reduce) {
      punch.setValue(on ? 1 : 0);
      return;
    }
    Animated.parallel([
      // Pops past full when punched; never below empty, which would mirror it.
      Animated.spring(punch, { toValue: on ? 1 : 0, damping: 8, stiffness: 280, overshootClamping: !on, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(jolt, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(jolt, { toValue: 0, damping: 6, stiffness: 320, useNativeDriver: true }),
      ]),
    ]).start();
  }, [on, reduce, punch, jolt]);

  const stamp = cardStamp(on);
  return (
    <Animated.View
      style={{
        transform: [{ rotate: '-1.2deg' }, { translateY: jolt.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
      }}
    >
      <YStack backgroundColor="panel2" borderWidth={1} borderColor="lineStrong" padding="3" gap="2">
        <XStack justifyContent="space-between" alignItems="center" gap="2">
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
            {CARD_TITLE}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="dim">
            {CARD_NO}
          </PlainText>
        </XStack>
        <View style={{ height: 1, backgroundColor: t.line }} />
        {cardLines(on).map((line) => {
          const out = line.punch === 'OUT';
          return (
            <XStack key={line.punch} alignItems="center" gap="3">
              <View
                style={{
                  width: HOLE,
                  height: HOLE,
                  borderRadius: HOLE / 2,
                  borderWidth: 1.5,
                  borderColor: t.lineStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Animated.View
                  style={{
                    width: HOLE - 5,
                    height: HOLE - 5,
                    borderRadius: (HOLE - 5) / 2,
                    backgroundColor: out ? t.primary : t.fg,
                    transform: [{ scale: out ? punch : PUNCHED }],
                  }}
                />
              </View>
              <PlainText fontFamily="mono" fontSize={12} letterSpacing={1.2} width={34} color={out && on ? 'primary' : 'fg'}>
                {line.punch}
              </PlainText>
              <PlainText fontSize={13} color="muted" flex={1}>
                {line.when}
              </PlainText>
            </XStack>
          );
        })}
        <XStack justifyContent="flex-end">
          <Stamp key={stamp} slam={slam} tone={on ? 'primary' : 'secondary'}>
            {stamp}
          </Stamp>
        </XStack>
      </YStack>
    </Animated.View>
  );
}

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useTheme } from './globals';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  children: string;
  slam?: boolean;
  tone?: 'primary' | 'secondary';
  /** Across a whole card (a work order filed): twice the size, inked heavier, on the card's paper. */
  big?: boolean;
};

// The site's rubber stamp (.stamp): a red outline label tilted -4°, for a
// moment worth marking (ACTIVE, RECOMMENDED, READY). `slam` lands it like a
// stamp on paper the first time it shows.
export default function Stamp({ children, slam = false, tone = 'primary', big = false }: Props) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const land = useRef(new Animated.Value(slam ? 0 : 1)).current;

  useEffect(() => {
    if (!slam) return;
    if (reduce) {
      land.setValue(1);
      return;
    }
    Animated.timing(land, { toValue: 1, duration: 320, delay: 180, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }).start();
  }, [slam, reduce, land]);

  const ink = tone === 'primary' ? t.primary : t.secondaryInk;
  return (
    <Animated.Text
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: big ? 14 : 7,
        paddingVertical: big ? 6 : 4,
        borderWidth: big ? 3 : 1,
        borderColor: ink,
        backgroundColor: big ? t.panel : undefined,
        color: ink,
        fontFamily: big ? 'GeistMono-Bold' : 'GeistMono-Regular',
        fontSize: big ? 22 : 10,
        letterSpacing: big ? 4 : 1.4,
        textTransform: 'uppercase',
        opacity: land.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.9, 0.9] }),
        transform: [
          { rotate: big ? '-7deg' : '-4deg' },
          { scale: land.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.Text>
  );
}

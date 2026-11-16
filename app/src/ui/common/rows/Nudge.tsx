import { type ReactNode, useContext } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { RowPress } from './place';

// How far a link row's › leans toward the page it opens while the row is
// held; it springs back on release (RowFrame's spring).
const LEAN = 5;

export default function Nudge({ children }: { children: ReactNode }) {
  const pressed = useContext(RowPress);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (pressed?.value ?? 0) * LEAN }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

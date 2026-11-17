import type { ReactNode } from 'react';
import { type AccessibilityState, Pressable } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import { HIT, useTheme } from '../globals';
import { useReduceMotion } from '../useReduceMotion';
import DashedRule from './DashedRule';
import { ROW_GUTTER, RowPress, useInRowGroup } from './place';

type Press = {
  onPress?: () => void;
  role: 'button' | 'switch' | 'radio';
  label: string;
  hint?: string;
  state?: AccessibilityState;
};

type Props = {
  children: ReactNode;
  /** A row you press: Android's ripple across it, and RowPress for what moves with it. */
  press?: Press;
  /** Half faded: it is busy (or can't be picked) and takes no press: no ripple, no lean, disabled to a screen reader. */
  dim?: boolean;
  /**
   * How far the press area reaches past its slot on each side (the padding
   * and gaps around it), so no strip beside it is dead. Its words and the
   * layout around it stay where they were.
   */
  reach?: { x: number; y: number };
  /** Its content keeps its own padding and press (an agent line, a schedule); the frame only draws its rule. */
  bare?: boolean;
  /** The picked one of a pick-one list: a red bar down its left edge on a faint red tint. */
  picked?: boolean;
};

// Down fast, back with a little bounce.
const PRESS_IN = { damping: 30, stiffness: 600 };
const PRESS_OUT = { damping: 9, stiffness: 220 };

// The shell every row sits in: its padding and height, and in a group the
// dashed rule under it. On its own (the drawer) it keeps the slim padding
// and no rule. A press is Android's ripple: amber in a group, as the key
// strip's ink; on its own the palette's hairline ink (Material's pressed
// layer).
export default function RowFrame({ children, press, dim = false, reach, bare = false, picked = false }: Props) {
  const t = useTheme();
  const grouped = useInRowGroup();
  const reduce = useReduceMotion();
  const pressed = useSharedValue(0);
  const body = (
    <YStack
      minHeight={bare ? undefined : grouped ? 56 : HIT.buttonH}
      justifyContent="center"
      paddingHorizontal={bare ? 0 : grouped ? ROW_GUTTER : '2'}
      paddingVertical={bare ? 0 : grouped ? '3' : '2'}
      opacity={dim ? 0.5 : 1}
      backgroundColor={picked ? 'primarySoft' : undefined}
    >
      {picked ? <YStack position="absolute" left={0} top={0} bottom={0} width={3} backgroundColor="primary" /> : null}
      {children}
      {grouped ? <DashedRule /> : null}
    </YStack>
  );
  if (!press) return body;
  const sink = (to: number) => {
    pressed.value = reduce ? to : withSpring(to, to ? PRESS_IN : PRESS_OUT);
  };
  return (
    <RowPress.Provider value={pressed}>
      <Pressable
        onPress={dim ? undefined : press.onPress}
        onPressIn={dim ? undefined : () => sink(1)}
        onPressOut={dim ? undefined : () => sink(0)}
        android_ripple={dim ? undefined : { color: grouped ? t.secondarySoft : t.line }}
        style={
          reach && {
            marginHorizontal: -reach.x,
            marginVertical: -reach.y,
            paddingHorizontal: reach.x,
            paddingVertical: reach.y,
          }
        }
        accessibilityRole={press.role}
        accessibilityLabel={press.label}
        accessibilityHint={press.hint}
        accessibilityState={dim ? { ...press.state, disabled: true } : press.state}
      >
        {body}
      </Pressable>
    </RowPress.Provider>
  );
}

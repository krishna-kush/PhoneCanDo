import type { ReactNode } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { moveId } from '../../../state/logic/agentOrder';
import { useTheme } from '../../common/globals';
import { liftBuzz, stepTick } from './feel';
import { dropSlot, HOLD_MS, HOLD_SLOP } from './logic/slots';
import { useReorder } from './ReorderList';

/** How fast the other rows make room, and the lifted one settles. */
const SHIFT_MS = 160;
const LIFT_SCALE = 1.02;

type Props = {
  id: string;
  /** Its place in the order React was given; until `order` names it. */
  index: number;
  /** A hold let go without a drag: what a long press does. */
  onHold: () => void;
  children: ReactNode;
};

// One row of a ReorderList. A hold lifts it (raised, on the panel's
// colour, a touch bigger, with a buzz) and it follows the finger up and
// down; the rows it passes slide out of its way, a tick each (feel.ts). Let go and it settles in its new place,
// and the list hears the new order. Let go without moving and it was a
// long press. The hold is the gesture handler's, on the UI thread: moving
// before it lifts is a scroll or the drawer's swipe, never a drag, and a
// lift cancels the row's own tap.
export default function ReorderRow({ id, index, onHold, children }: Props) {
  const t = useTheme();
  const { order, lifted, from, dy, slot, measured, onDrop, onLift } = useReorder();
  const travel = useSharedValue(0);

  const pan = usePanGesture({
    activateAfterLongPress: HOLD_MS,
    onActivate: () => {
      const at = order.value.indexOf(id);
      from.value = at < 0 ? index : at;
      dy.value = 0;
      travel.value = 0;
      lifted.value = id;
      scheduleOnRN(onLift, true);
      scheduleOnRN(liftBuzz);
    },
    onUpdate: (e) => {
      dy.value = e.translationY;
      travel.value = Math.max(travel.value, Math.abs(e.translationY));
      const next = moveId(order.value, id, dropSlot(from.value, e.translationY, slot.value, order.value.length));
      if (next === order.value) return;
      order.value = next;
      scheduleOnRN(stepTick);
    },
    onDeactivate: (e) => {
      const at = order.value.indexOf(id);
      const landed = at < 0 ? from.value : at;
      dy.value = withTiming((landed - from.value) * slot.value, { duration: SHIFT_MS }, () => {
        lifted.value = '';
      });
      scheduleOnRN(onLift, false);
      if (landed !== from.value) scheduleOnRN(onDrop, order.value);
      else if (!e.canceled && travel.value < HOLD_SLOP) scheduleOnRN(onHold);
    },
  });

  const style = useAnimatedStyle(() => {
    if (lifted.value === id) {
      return {
        zIndex: 1,
        elevation: 8,
        backgroundColor: t.panel,
        transform: [{ translateY: from.value * slot.value + dy.value }, { scale: withTiming(LIFT_SCALE, { duration: SHIFT_MS }) }],
      };
    }
    const at = order.value.indexOf(id);
    return {
      zIndex: 0,
      elevation: 0,
      backgroundColor: 'transparent',
      transform: [
        { translateY: withTiming((at < 0 ? index : at) * slot.value, { duration: SHIFT_MS }) },
        { scale: withTiming(1, { duration: SHIFT_MS }) },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]}
        onLayout={(e) => measured(e.nativeEvent.layout.height)}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

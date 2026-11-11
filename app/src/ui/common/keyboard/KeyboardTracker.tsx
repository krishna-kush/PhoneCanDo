import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useKeyboardStore } from '../../../state/keyboard';
import { KB_BREATHE, spacerPad } from '../../terminal/sizing';
import { keyboardRoom } from './room';

function setOpen(open: boolean) {
  useKeyboardStore.getState().setOpen(open);
}

function logSettled(height: number, room: number) {
  console.log(`[phonecando-kb] live height=${height} pad=${room}`);
}

// Feeds the keyboard's room (room.ts) from the live native height, on the
// UI thread: every frame while the keyboard moves, then where it settles.
// Live e.height, not the one-shot keyboardDidShow, which understates Gboard:
// it keeps growing after (toolbar late-load, suggestion strip) with no
// follow-up event. JS hears only whether the keyboard is open, when that
// changes. Mounted once, inside the KeyboardProvider and the
// SafeAreaProvider (the room starts above the bottom inset); draws nothing.
export default function KeyboardTracker() {
  const insetBottom = useSafeAreaInsets().bottom;
  const open = useSharedValue(false);
  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet';
        const room = e.height > 0 ? spacerPad(e.height, insetBottom, KB_BREATHE) : 0;
        keyboardRoom.value = room;
        if (room > 0 !== open.value) {
          open.value = room > 0;
          scheduleOnRN(setOpen, room > 0);
        }
      },
      onEnd: (e) => {
        'worklet';
        const room = e.height > 0 ? spacerPad(e.height, insetBottom, KB_BREATHE) : 0;
        keyboardRoom.value = room;
        open.value = room > 0;
        scheduleOnRN(setOpen, room > 0);
        scheduleOnRN(logSettled, Math.round(e.height), Math.round(room));
      },
    },
    [insetBottom],
  );
  return null;
}

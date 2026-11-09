import { makeMutable } from 'react-native-reanimated';

// The room the soft keyboard takes from the bottom of the screen, in dp,
// live on the UI thread: every animation frame while it moves, then where
// it settles (KeyboardTracker.tsx works it out: its height above the bottom
// safe area, plus a little air; terminal/sizing.ts). A terminal's spacer
// follows it there, frame by frame, with no JS in between: driven through
// React state each step reached the screen ~65 ms late, so the accessory
// bar crawled behind the keyboard and then jumped into place.
export const keyboardRoom = makeMutable(0);

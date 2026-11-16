import { Vibration } from 'react-native';

// What a drag feels like under the finger: a buzz as a row lifts, a tick
// each time it passes another row. Android's own vibrator, through React
// Native (the app has VIBRATE from Expo's defaults).

const LIFT_MS = 50;
const STEP_MS = 20;

export function liftBuzz() {
  Vibration.vibrate(LIFT_MS);
}

export function stepTick() {
  Vibration.vibrate(STEP_MS);
}

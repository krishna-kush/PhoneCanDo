import { Vibration } from 'react-native';

// What ringing the alarm clock feels like under the finger: a short buzz
// for each rattle on its feet, in step with the clock's shake. Android's
// own vibrator, through React Native (the app has VIBRATE from Expo's
// defaults).

/** One buzz of a rattle; the rest of the rattle is still. */
const BUZZ_MS = 22;

/** A buzz every [rattleMs], [rattles] times. */
export function ringBuzz(rattleMs: number, rattles: number) {
  const pattern = [0];
  for (let i = 0; i < rattles; i++) pattern.push(BUZZ_MS, rattleMs - BUZZ_MS);
  Vibration.vibrate(pattern);
}

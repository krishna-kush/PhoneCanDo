// Reading ./manage's arguments.
import { die } from './errors.mjs';

export const CHANNELS = ['lite', 'full', 'play'];
// What a release ships; build makes one of them.
export const RELEASED = ['full', 'lite'];

/** The channel named first, or a usage error. */
export function channelArg(args) {
  if (!CHANNELS.includes(args[0])) die(`channel must be one of ${CHANNELS.join(', ')}`);
  return args[0];
}

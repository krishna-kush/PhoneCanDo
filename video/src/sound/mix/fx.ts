// The send effects: a dotted-8th ping-pong echo and a room, fed by each
// track's sends. Both are emptied at every cut, so no tail crosses a
// silence into what comes after it.

import { BEAT } from '../../timeline/tempo.ts';
import { samplesOf } from '../rate.ts';
import { SENDS, TRACKS, type Tracks } from '../score/tracks.ts';
import { PingPong } from '../synth/delay.ts';
import { Reverb } from '../synth/reverb.ts';
import { stereo, type Stereo } from '../synth/stereo.ts';

/** The echo's level against the room's, in the wet sum. */
const ECHO = 0.55;
const ROOM = 1;

export function effects(tracks: Tracks, cuts: readonly number[], n: number): Stereo {
  const toEcho = stereo(n);
  const toRoom = stereo(n);
  for (const t of TRACKS) {
    const { delay, reverb } = SENDS[t];
    const src = tracks[t];
    for (let i = 0; i < n; i++) {
      if (delay) {
        toEcho.l[i] += src.l[i] * delay;
        toEcho.r[i] += src.r[i] * delay;
      }
      if (reverb) {
        toRoom.l[i] += src.l[i] * reverb;
        toRoom.r[i] += src.r[i] * reverb;
      }
    }
  }
  const echo = stereo(n);
  const room = stereo(n);
  const pingPong = new PingPong(samplesOf(0.75 * BEAT), 0.38, 0.35);
  const reverb = new Reverb(0.72, 0.45);
  const edges = [0, ...cuts.filter((c) => c > 0 && c < n), n];
  for (let k = 0; k + 1 < edges.length; k++) {
    pingPong.process(toEcho, echo, edges[k], edges[k + 1]);
    reverb.process(toRoom, room, edges[k], edges[k + 1]);
    pingPong.reset();
    reverb.reset();
  }
  const wet = stereo(n);
  for (let i = 0; i < n; i++) {
    wet.l[i] = echo.l[i] * ECHO + room.l[i] * ROOM;
    wet.r[i] = echo.r[i] * ECHO + room.r[i] * ROOM;
  }
  return wet;
}

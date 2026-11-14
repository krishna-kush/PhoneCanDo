// The send effects: a dotted-8th ping-pong echo and a room, fed by each
// track's sends. Both are emptied at every cut, so no tail crosses a
// silence into what comes after it.

import type { Clock } from '../clock.ts';
import { samplesOf } from '../rate.ts';
import { PingPong } from '../synth/delay.ts';
import { Reverb } from '../synth/reverb.ts';
import { stereo, type Stereo } from '../synth/stereo.ts';

/** A track and the share of it sent to the echo and to the room. */
export type Feed = { track: Stereo; echo?: number; room?: number };

/** The echo's level against the room's, in the wet sum. */
const ECHO = 0.55;
const ROOM = 1;

/** What the echo and the room answer to [feeds], [n] samples long; [cuts] are samples. */
export function sends(clock: Clock, feeds: readonly Feed[], cuts: readonly number[], n: number): Stereo {
  const toEcho = stereo(n);
  const toRoom = stereo(n);
  for (const { track, echo, room } of feeds) {
    for (let i = 0; i < n; i++) {
      if (echo) {
        toEcho.l[i] += track.l[i] * echo;
        toEcho.r[i] += track.r[i] * echo;
      }
      if (room) {
        toRoom.l[i] += track.l[i] * room;
        toRoom.r[i] += track.r[i] * room;
      }
    }
  }
  const echoed = stereo(n);
  const roomed = stereo(n);
  const pingPong = new PingPong(samplesOf(clock.secondsOf(0.75)), 0.38, 0.35);
  const reverb = new Reverb(0.72, 0.45);
  const edges = [0, ...cuts.filter((c) => c > 0 && c < n).sort((a, b) => a - b), n];
  for (let k = 0; k + 1 < edges.length; k++) {
    pingPong.process(toEcho, echoed, edges[k], edges[k + 1]);
    reverb.process(toRoom, roomed, edges[k], edges[k + 1]);
    pingPong.reset();
    reverb.reset();
  }
  const wet = stereo(n);
  for (let i = 0; i < n; i++) {
    wet.l[i] = echoed.l[i] * ECHO + roomed.l[i] * ROOM;
    wet.r[i] = echoed.r[i] * ECHO + roomed.r[i] * ROOM;
  }
  return wet;
}

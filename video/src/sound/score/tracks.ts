// The music's tracks: a stereo buffer each, what each sends to the echo and
// the room, how loud each sits, and how hard the kick pumps it.

import { stereo, type Stereo } from '../synth/stereo.ts';

export const TRACKS = ['kick', 'drums', 'hats', 'crash', 'bass', 'pad', 'lead', 'arp', 'bell'] as const;

export type TrackId = (typeof TRACKS)[number];

export type Tracks = Record<TrackId, Stereo>;

export const tracksOf = (n: number): Tracks => Object.fromEntries(TRACKS.map((t) => [t, stereo(n)])) as Tracks;

/** Each track's share sent to the ping-pong echo and to the room. */
export const SENDS: Record<TrackId, { delay: number; reverb: number }> = {
  kick: { delay: 0, reverb: 0 },
  drums: { delay: 0, reverb: 0.16 },
  hats: { delay: 0, reverb: 0.04 },
  crash: { delay: 0, reverb: 0.1 },
  bass: { delay: 0, reverb: 0 },
  pad: { delay: 0, reverb: 0.22 },
  lead: { delay: 0.2, reverb: 0.16 },
  arp: { delay: 0.3, reverb: 0.12 },
  bell: { delay: 0.18, reverb: 0.4 },
};

/**
 * How loud each track sits, as its own integrated loudness (LUFS) once
 * calibrated: kick and bass carry it, the hook sings over the pad, the
 * hats and cymbals stay air.
 */
export const LOUDNESS: Record<TrackId, number> = {
  kick: -14,
  drums: -16.5,
  hats: -23,
  crash: -25,
  bass: -15.5,
  pad: -20,
  lead: -15,
  arp: -21,
  bell: -20,
};

/** How deep the kick pumps each track, 0 to 1. */
export const PUMP: Partial<Record<TrackId, number>> = { bass: 0.7, pad: 0.6, arp: 0.3, lead: 0.12, bell: 0.2 };

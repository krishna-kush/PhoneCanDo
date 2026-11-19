// The music's tracks, in the order the mix sums them: how loud each sits
// (its own integrated loudness, LUFS, once calibrated: kick and bass carry
// it, the hook sings over the pad, the hats and cymbals stay air), how
// hard the kick pumps it, and what it sends to the echo and the room.

import type { Track } from '../../../engine/sound/sound.ts';

export const TRACKS = {
  kick: { loudness: -14 },
  drums: { loudness: -16.5, room: 0.16 },
  hats: { loudness: -23, room: 0.04 },
  crash: { loudness: -25, room: 0.1 },
  bass: { loudness: -15.5, pump: 0.7 },
  pad: { loudness: -20, pump: 0.6, room: 0.22 },
  lead: { loudness: -15, pump: 0.12, echo: 0.2, room: 0.16 },
  arp: { loudness: -21, pump: 0.3, echo: 0.3, room: 0.12 },
  bell: { loudness: -20, pump: 0.2, echo: 0.18, room: 0.4 },
} as const satisfies Record<string, Track>;

export type TrackId = keyof typeof TRACKS;

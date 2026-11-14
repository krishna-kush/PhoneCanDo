// The music's tracks, in the order the mix sums them: how loud each sits,
// how hard the kick pumps it, and what it sends to the echo and the room.
// The narrator has a track of his own, so he can be muted if a voice-over
// ever takes his place.

import type { Track } from '../../../engine/sound/sound.ts';

/**
 * Each track's loudness is its own integrated loudness (LUFS) once
 * calibrated, so it is how loud the track's loudest stretches sit: kick
 * and bass carry the drop, the lead and the marimba sing the hook over
 * them, the narrator is plain under the crew, the hats and cymbals stay
 * air.
 */
export const TRACKS = {
  kick: { loudness: -14 },
  drums: { loudness: -17, room: 0.16 },
  hats: { loudness: -24, room: 0.04 },
  crash: { loudness: -25, room: 0.1 },
  bass: { loudness: -15.5, pump: 0.7 },
  pad: { loudness: -23, pump: 0.4, room: 0.25 },
  stab: { loudness: -19, pump: 0.5, room: 0.2 },
  arp: { loudness: -22, pump: 0.3, echo: 0.3, room: 0.12 },
  lead: { loudness: -16, pump: 0.12, echo: 0.2, room: 0.16 },
  marimba: { loudness: -17, pump: 0.1, echo: 0.1, room: 0.22 },
  pizz: { loudness: -19, room: 0.22 },
  bell: { loudness: -20, echo: 0.18, room: 0.4 },
  whistle: { loudness: -21, room: 0.2 },
  narrator: { loudness: -22, room: 0.18 },
} as const satisfies Record<string, Track>;

export type TrackId = keyof typeof TRACKS;

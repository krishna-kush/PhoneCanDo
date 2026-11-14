// The band: which of the engine's voices plays each track, and how a note
// becomes its sound. A note's length and how hard it is played are all a
// voice gets, as a player does: harder is louder and brighter, a long pad
// swells in slowly, a long stab or bell is left to ring.

import { crash } from '../../../engine/sound/instruments/drums/crash.ts';
import { hat } from '../../../engine/sound/instruments/drums/hats.ts';
import { thump } from '../../../engine/sound/instruments/drums/kick.ts';
import { clap, rim, snare } from '../../../engine/sound/instruments/drums/snare.ts';
import { bass } from '../../../engine/sound/instruments/voices/bass.ts';
import { bell } from '../../../engine/sound/instruments/voices/bell.ts';
import { lead } from '../../../engine/sound/instruments/voices/lead.ts';
import { marimba } from '../../../engine/sound/instruments/voices/marimba.ts';
import { pad } from '../../../engine/sound/instruments/voices/pad.ts';
import { pizz } from '../../../engine/sound/instruments/voices/pizz.ts';
import { pluck } from '../../../engine/sound/instruments/voices/pluck.ts';
import { reed } from '../../../engine/sound/instruments/voices/reed.ts';
import { whistle } from '../../../engine/sound/instruments/voices/whistle.ts';
import { kickAt, put, type Ctx as Stage } from '../../../engine/sound/score/play.ts';
import { hz } from '../../../engine/sound/synth/pitch.ts';
import { seedOf } from '../../../engine/sound/synth/rand.ts';
import type { Stereo } from '../../../engine/sound/synth/stereo.ts';
import { KIT } from './kit.ts';
import { clamp, type Note } from './notes.ts';
import type { Span } from './plan.ts';
import type { TrackId } from './tracks.ts';

/** What the band plays onto: the engine's stage holding this score's tracks, and the span of the plan being played. */
export type Ctx = Stage<TrackId, Span>;

/** A track's voice: the sound of [n], held [seconds]. */
type Voice = (n: Note, seconds: number) => Float32Array | Stereo;

const seed = (n: Note) => seedOf(n.track, n.midi, n.at);

/** The drums and the hats: the drum a note names (kit.ts). A roll's snare rises in pitch as it gets louder. */
const drum: Voice = (n) => {
  switch (n.midi) {
    case KIT.rim:
      return rim({ seed: seed(n) });
    case KIT.clap:
      return clap({ seed: seed(n) });
    case KIT.brush:
      return snare({ tone: 210, decay: 0.05, seed: seed(n) });
    case KIT.open:
      return hat({ open: true, seed: seed(n) });
    case KIT.hat:
      return hat({ seed: seed(n) });
    default:
      return snare({ tone: 170 + 75 * Math.min(1, n.vel), seed: seed(n) });
  }
};

const VOICES: Record<Exclude<TrackId, 'kick'>, Voice> = {
  drums: drum,
  hats: drum,
  crash: (n, s) => crash({ decay: clamp(s / 3.6, 0.3, 0.8), seed: seed(n) }),
  bass: (n, s) => bass({ midi: n.midi, len: s, sweep: 800 + 1700 * Math.min(1, n.vel) }),
  // Soft and slow: the longer the chord, the slower it swells in and lets go.
  pad: (n, s) => pad({ notes: [n.midi], len: s, attack: Math.min(0.5, s * 0.35), release: Math.min(0.6, 0.15 + s * 0.2), cutoff: 500 + 2500 * Math.min(1, n.vel) ** 2 }),
  // Struck and let go: a short one is a stab, a long one rings out.
  stab: (n, s) => pad({ notes: [n.midi], len: s, attack: 0.005, release: 0.09, cutoff: 1800 + 3400 * Math.min(1, n.vel), decay: Math.max(0.12, s * 0.45) }),
  arp: (n, s) => pluck({ midi: n.midi, len: s, duty: 0.25, cutoff: 800 * 10 ** Math.min(1, n.vel), decay: 0.07 }),
  lead: (n, s) => lead({ midi: n.midi, len: s, from: n.from }),
  marimba: (n, s) => marimba({ midi: n.midi, len: s, hard: 0.3 + 0.4 * Math.min(1, n.vel), seed: seed(n) }),
  pizz: (n, s) => pizz({ midi: n.midi, len: s, bright: 0.2 + 0.25 * Math.min(1, n.vel), seed: seed(n) }),
  // A music box: glassy, ringing a little longer than the note is written.
  bell: (n, s) => bell({ freq: hz(n.midi), ratio: 3.5, index: 1 + Math.min(1, n.vel), decay: clamp(s * 0.6, 0.12, 0.9) }),
  whistle: (n, s) => whistle({ from: n.from ?? n.midi, to: n.midi, len: s, seed: seed(n) }),
  narrator: (n, s) => reed({ midi: n.midi, len: s }),
};

/** Plays [notes] onto the stage's tracks. A kick is noted for the pump; the thump is a heartbeat and pumps nothing. */
export function play(ctx: Ctx, notes: readonly Note[]) {
  const { secondsOf } = ctx.clock;
  for (const n of notes) {
    const seconds = secondsOf(n.len);
    if (n.track !== 'kick') put(ctx, n.track, VOICES[n.track](n, seconds), n.at, n.vel, n.pan ?? 0);
    else if (n.midi === KIT.thump) put(ctx, 'kick', thump(seed(n)), n.at, n.vel);
    // A kick a beat long is the plain one; a longer one booms.
    else kickAt(ctx, n.at, n.vel, { decay: clamp(seconds * 0.34, 0.12, 0.45) });
  }
}

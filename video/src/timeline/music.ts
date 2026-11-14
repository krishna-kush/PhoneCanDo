// The music's sections, by kind: what plays. The picture only says when
// each kind starts (a scene's `music`, and a script's `changes` inside a
// scene); the sound side (src/sound/) writes the notes. One key and one
// progression run through it all, A minor, a bar a chord: Am F C G.

export const SECTIONS = {
  intro: 'Curious and small: a lowpassed square arp and ticking 16th hats, no kick. The phone left alone.',
  build: 'The arp opens up bar by bar, a kick on every beat comes in, a snare roll speeds up through the last bar.',
  drop: 'The full groove: four-on-the-floor kick, clap on 2 and 4, 16th hats, an offbeat bass, chord stabs and a bright chiptune hook over two bars.',
  stop: 'Silence, entered through a tape stop: the music slows and pitches down to nothing over half a beat.',
  tech: 'The machine room: kick, glitchy 16th hats and rimshots, a 16th-note bass pulse and fast square arps. No hook.',
  halftime: 'Night: kick on 1, snare on 3, soft chords and a music-box line; its second bar brightens toward morning.',
  breakdown: 'Held breath: no drums, a sub pulse on each beat like a heartbeat, a dark pad under it.',
  lift: 'Climbing back: a snare roll from 8ths to 32nds and a filter sweeping up (the riser is the script’s).',
  finale: 'The last drop, bigger than the first: everything from `drop`, the hook an octave up, a crash on every bar.',
  outro: 'One big hit on its first beat, a held chord ringing out, then a small arp fading to nothing.',
  gap: 'Silence with no tail: the half beat before a drop.',
} as const;

export type Section = keyof typeof SECTIONS;

/** A change of section partway through a scene, from its start. */
export type Change = { at: number; section: Section };

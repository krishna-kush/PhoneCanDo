// The drum kit: which note is which drum on the drum tracks, by General
// MIDI's numbers. The thump is the kick with no click, a heartbeat; the
// rim is also the night's woodblock tick.

export const KIT = {
  thump: 35,
  kick: 36,
  rim: 37,
  snare: 38,
  clap: 39,
  brush: 40,
  hat: 42,
  open: 46,
  crash: 49,
} as const;

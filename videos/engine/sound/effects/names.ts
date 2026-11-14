// Every sound effect a film can ask for, by name, with what it should
// sound like. A film's script places them as cues (engine/beats/cue.ts);
// index.ts makes each one. Lengths are a guide; `len` is in beats where a
// sound takes one. The tuned ones sit in A minor: a cue's `pitch` moves
// one to another key.

export const EFFECTS = {
  tap: 'A fingertip on glass: a soft, short pop, ~60 ms.',
  key: 'One key of a phone keyboard: a tiny soft click, ~25 ms.',
  type: 'One key of a terminal: a crisp mechanical click, ~30 ms.',
  send: 'A message leaving: a quick rising swish-blip, ~250 ms.',
  notify: 'A phone notification: two bright notes, ~400 ms.',
  pop: 'Something popping into view: a round bubbly pop, ~120 ms; `pitch` moves it.',
  boing: 'A cartoon spring jump: a sine bending up, ~350 ms.',
  land: 'A small body landing: a soft low thud, ~150 ms.',
  chirp: 'A tiny robot talking: 2 to 4 quick FM bleeps, ~350 ms; `seed` picks the phrase (4 sounds sad).',
  whoosh: 'Air past the camera: filtered noise swelling and falling, ~500 ms.',
  whip: 'A whip pan: a short, sharp whoosh, ~200 ms.',
  impact: 'The drop hit: a sub boom, a noise crash and a little room, ~1.5 s.',
  slam: 'A word slamming down: a punchy thud with a crunch, ~250 ms.',
  stamp: 'A rubber stamp on paper: a thud and a paper slap, ~250 ms.',
  tick: 'A slot reel or a dial clicking one notch: a woody click, ~40 ms; `pitch` moves it.',
  ding: 'A reel landing, a job done: a bright bell, ~800 ms.',
  scratch: 'A record scratch, ~400 ms. The music stops under it (the score’s plan says so).',
  glitch: 'A digital glitch burst: bit-crushed noise and blips, ~300 ms.',
  riser: 'A tension riser: noise and a saw climbing for `len` beats, ending at the cue plus `len`.',
  card: 'A playing card flicked onto a table: a papery flick, ~120 ms; `pitch` moves it.',
  paper: 'A paper plane flying past: a light airy swish, ~400 ms.',
  clock: 'A clock ticking: one tick, ~50 ms.',
  sunrise: 'Morning: a warm rising major arpeggio with shimmer, ~1.2 s.',
  lock: 'A heavy latch locking: a metallic clunk, ~300 ms.',
  denied: 'Not allowed: a low double buzz, ~300 ms.',
  scan: 'A fingerprint scan: a rising sine sweep with shimmer for `len` beats.',
  unlock: 'Unlocked: a bright three-note chime, ~600 ms.',
  progress: 'A download racing: a run of rising blips for `len` beats.',
} as const;

export type EffectName = keyof typeof EFFECTS;

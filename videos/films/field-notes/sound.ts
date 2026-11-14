// Field Notes' sound: its tempo and length from the beat line, an effect
// for everything that happens on screen, and its own score (score/): the
// narrator's theme against the crew's hook. Every effect's time is taken
// from the picture's moments, so a retimed gag takes its sound with it;
// the tuned ones are pitched to the note the score plays with them.
// Between the stare at the gate and the scan there are none; between the
// narrator's "no sound" and the drop, only the taps.

import type { Cue } from '../../engine/beats/cue.ts';
import type { EffectName } from '../../engine/sound/effects/names.ts';
import type { Sound } from '../../engine/sound/sound.ts';
import { LINE, START, TEMPO } from './beats.ts';
import { scoreOf } from './score/score.ts';
import { RUNNING } from './score/sections/tools.ts';
import { LAMPS, POPS } from './score/themes.ts';
import { MOMENTS } from './script/moments.ts';

type Effect = Cue<EffectName>;

const m = MOMENTS;

/** The tick sounds E6: pitched to a lamp's note, an octave above it. */
const tickOn = (midi: number) => midi + 12 - 88;

/** The pops rise with the marimba's run, half as far: an octave and a bit from first to last. */
const popOn = (midi: number) => (midi - POPS[0]) / 2;

/** -1 to 1 across [n] things, left to right. */
const across = (i: number, n: number, width = 0.6) => (n > 1 ? -width + (2 * width * i) / (n - 1) : 0);

/** The effects' chimes sit in A minor; three semitones up they are in C major, for the morning. */
const MORNING = 3;

/** Every effect, in the film's running order. */
const CUES: readonly Effect[] = [
  // Lights: A-01 wakes with a "hm?", hops out, and each lamp clicks on.
  { at: m.lights.wake, sound: 'chirp', seed: 0, gain: 0.4 },
  { at: m.lights.hop, sound: 'boing', gain: 0.5 },
  ...m.lights.lamps.map((at, i): Effect => ({ at, sound: 'tick', pitch: tickOn(LAMPS[i]), pan: across(i, m.lights.lamps.length, 0.45), gain: 0.7 })),

  // Crew: a pop a unit, rising.
  ...m.crew.pops.map((at, i): Effect => ({ at, sound: 'pop', pitch: popOn(POPS[i]), pan: across(i, m.crew.pops.length), gain: 0.45 })),

  // Tools: the breaker's latch, the power sweeping up until the machines run, a key for each line, a ding for the fix.
  { at: m.tools.breaker, sound: 'lock', gain: 0.7 },
  { at: m.tools.breaker, sound: 'riser', len: RUNNING - m.tools.breaker, gain: 0.4 },
  ...m.tools.typing.map((at, i): Effect => ({ at, sound: 'type', pan: i % 2 ? 0.25 : -0.25 })),
  { at: m.tools.write, sound: 'ding', gain: 0.6 },

  // Gate: a thud a bonk, the scan, the plate stamped and the lock's chime (in A major), a riser as they walk through.
  ...m.gate.bonks.map((at, i): Effect => ({ at, sound: 'land', pitch: -i / 2, pan: i % 2 ? 0.3 : -0.3, gain: 0.6 })),
  { at: m.gate.scan[0], sound: 'scan', len: m.gate.scan[1] - m.gate.scan[0] },
  { at: m.gate.armed, sound: 'stamp', gain: 0.9 },
  { at: m.gate.armed, sound: 'unlock', pitch: -3, gain: 0.8 },
  { at: m.gate.through, sound: 'riser', len: START.chores - m.gate.through, gain: 0.5 },

  // Chores: a stamp a chore, and a riser from the last one to the cut.
  ...m.chores.done.map((at): Effect => ({ at, sound: 'stamp' })),
  { at: m.chores.done[m.chores.done.length - 1], sound: 'riser', len: m.song.line - m.chores.done[m.chores.done.length - 1], gain: 0.7 },

  // Song: the needle tapped, dry; the drop; a ding for the fix.
  ...m.song.taps.map((at): Effect => ({ at, sound: 'tap' })),
  { at: m.song.drop, sound: 'impact' },
  { at: m.song.write, sound: 'ding' },

  // Dawn: the bell, loud; a tick as each floor goes dark; the gate's latch; a pop for the hat; a small ding when he is right; morning.
  ...m.dawn.bell.map((at): Effect => ({ at, sound: 'ding', gain: 1.3 })),
  ...m.dawn.out.map((at, i): Effect => ({ at, sound: 'tick', pitch: tickOn(LAMPS[LAMPS.length - 1 - i]), pan: -across(i, m.dawn.out.length, 0.45), gain: 0.7 })),
  { at: m.dawn.shut, sound: 'lock', gain: 0.7 },
  { at: m.dawn.grab, sound: 'pop', pitch: 12, gain: 0.6 },
  { at: m.dawn.right, sound: 'ding', gain: 0.5 },
  { at: m.dawn.card, sound: 'notify', pitch: MORNING, gain: 0.8 },
  { at: m.dawn.card, sound: 'sunrise', gain: 0.7 },

  // End: the button slams down, A-01 springs up and says bye, and one last ding from inside, up in C.
  { at: m.end.button, sound: 'slam', gain: 0.7 },
  { at: m.end.peek, sound: 'boing', gain: 0.6 },
  { at: m.end.blink, sound: 'chirp', seed: 5, gain: 0.5 },
  { at: m.end.ding, sound: 'ding', pitch: MORNING, gain: 0.7 },
];

export const sound: Sound = { tempo: TEMPO, beats: LINE.total, cues: CUES, music: scoreOf(LINE.total) };

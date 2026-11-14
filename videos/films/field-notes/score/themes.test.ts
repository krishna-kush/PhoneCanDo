// The themes' promises: the narrator's theme and the crew's hook are the
// notes the film was written to, and the fragments heard before the drop
// (the lamps, the pops, the pile-up) are cut from them.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BARS, degree, HANG, HOME, HOOK, LAMPS, MINOR, NARRATOR, OPENING, PENTATONIC, POPS, RESOLVE, STUMBLE } from './themes.ts';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** A MIDI note by name: 69 is A4. */
const name = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const names = (notes: readonly number[]) => notes.map(name).join(' ');

test('the narrator: A2 E3 D3 C3 and B2 left hanging, four slow beats back to back', () => {
  assert.equal(names(NARRATOR.map(([, midi]) => midi)), 'A2 E3 D3 C3 B2');
  assert.deepEqual(NARRATOR.map(([, , len]) => len), [1, 1, 0.5, 0.5, 1]);
  NARRATOR.forEach(([at, , len], i) => assert.equal(at + len, NARRATOR[i + 1]?.[0] ?? 4, 'each note runs up to the next'));
  assert.equal(NARRATOR.find(([at]) => at === HANG)?.[1], RESOLVE[0], 'the hanging note is the one that resolves');
  assert.equal(names(RESOLVE), 'B2 C3');
});

test('the narrator at home: the same climb and fall in C major, ending on its C', () => {
  assert.equal(names(HOME), 'C3 G3 F3 E3 D3 C3');
  // A fifth up, then down by step, as at night: only the key and the ending differ.
  const shape = (notes: readonly number[]) => notes.slice(1).map((m, i) => Math.sign(m - notes[i]));
  assert.deepEqual(shape(HOME.slice(0, 5)), shape(NARRATOR.map(([, midi]) => midi)));
});

test('the hook: four bars over Am, F, C and G on the 16th grid', () => {
  const written = (bar: keyof typeof HOOK) => HOOK[bar].map(([s, midi]) => `s${s} ${name(midi)}`).join(', ');
  assert.deepEqual(BARS, ['Am', 'F', 'C', 'G']);
  assert.equal(written('Am'), 's0 A4, s2 C5, s4 E5, s7 E5, s8 A5, s10 G5, s12 E5');
  assert.equal(written('F'), 's0 A4, s2 C5, s4 F5, s7 F5, s8 A5, s10 G5, s12 F5');
  assert.equal(written('C'), 's0 G4, s2 C5, s4 E5, s7 E5, s8 C6, s10 A5, s12 G5, s14 E5');
  assert.equal(written('G'), 's0 G4, s2 B4, s4 D5, s7 D5, s8 G5, s10 E5, s12 D5');
  for (const bar of BARS) {
    const steps = HOOK[bar].map(([s]) => s);
    assert.deepEqual(steps.slice(0, 7), [0, 2, 4, 7, 8, 10, 12], `${bar} keeps the hook's rhythm`);
    assert.ok(steps.every((s, i) => s >= 0 && s < 16 && (i === 0 || s > steps[i - 1])), `${bar} stays in its bar, in order`);
  }
});

test('the fragments are cut from the hook', () => {
  assert.equal(names(LAMPS), 'A4 C5 E5 A5');
  const am = new Map<number, number>(HOOK.Am.map(([s, midi]) => [s, midi]));
  assert.deepEqual([0, 2, 4, 8].map((s) => am.get(s)), [...LAMPS], 'the lamps are the notes the Am bar climbs through');
  assert.deepEqual(HOOK.Am.slice(0, OPENING).map(([, midi]) => midi), LAMPS.slice(0, OPENING), 'its opening cell is the first three');
  // The leap the ta-da is made of: the fifth, then the octave.
  assert.deepEqual([am.get(7)! - 69, am.get(8)! - 69], [7, 12]);

  assert.equal(names(POPS), 'A3 C4 D4 E4 G4 A4 C5 D5 E5 G5 A5 C6 D6');
  POPS.forEach((midi, i) => assert.equal(midi, degree(PENTATONIC, 57, i), 'the run is A minor pentatonic, a step a pop'));

  assert.equal(names(STUMBLE), 'E5 D#5 D5 C#5 C5 B4 A#4 A4');
  assert.equal(STUMBLE[0], am.get(12), 'the pile-up starts on the note the Am bar ends on');
  assert.equal(STUMBLE[STUMBLE.length - 1], HOOK.F[0][1], 'and lands on the note the F bar starts on');
});

test('a scale runs on through the octaves, up and down', () => {
  assert.deepEqual([0, 1, 2, 6, 7, 8, -1].map((k) => degree(MINOR, 45, k)), [45, 47, 48, 55, 57, 59, 43]);
});

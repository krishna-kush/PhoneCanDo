// The beat line's promises: seconds, frames and bars from one tempo, cues
// that keep their order, shots that follow one another.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, shift } from './cue.ts';
import { barOf, beatsOf, frameOf, secondsOf, tempoOf } from './tempo.ts';
import { timelineOf } from './timeline.ts';

test('a tempo turns beats into seconds, frames and bars', () => {
  const t = tempoOf(120);
  assert.equal(t.beat, 0.5);
  assert.equal(secondsOf(t, 8), 4);
  assert.equal(beatsOf(t, 4), 8);
  assert.equal(frameOf(t, 1, 60), 30);
  assert.equal(barOf(t, 7.99), 1);
  assert.equal(barOf(t, 8), 2);
});

test('run spaces cues evenly and shift keeps them in time order', () => {
  const taps = run(3, 1, 0.5, { sound: 'tap' });
  assert.deepEqual(taps.map((c) => c.at), [1, 1.5, 2]);
  const moved = shift([...taps, { at: 0, sound: 'pop' }], 4);
  assert.deepEqual(moved.map((c) => c.at), [4, 5, 5.5, 6]);
  assert.equal(moved[0].sound, 'pop');
});

test('shots follow one another and the line finds each from its first beat', () => {
  const line = timelineOf([
    { id: 'a', beats: 8 },
    { id: 'b', beats: 4 },
    { id: 'c', beats: 12 },
  ]);
  assert.equal(line.total, 24);
  assert.equal(line.startOf('c'), 12);
  assert.deepEqual(line.at(8), { shot: { id: 'b', beats: 4 }, index: 1, local: 0 });
  assert.equal(line.at(11.5).local, 3.5);
  assert.equal(line.at(99).shot.id, 'c');
  assert.throws(() => timelineOf([{ id: 'a', beats: 1 }, { id: 'a', beats: 1 }]));
});

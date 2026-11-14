// Field Notes' beat line: its tempo and its shots in running order. The
// picture, the sound and the render commands all read it. At 120 a minute
// a beat is half a second and 30 frames at 60 fps, so every hit lands on a
// whole frame; every shot starts on a bar line, so the music can change
// with the picture.

import { tempoOf } from '../../engine/beats/tempo.ts';
import { timelineOf } from '../../engine/beats/timeline.ts';

export const TEMPO = tempoOf(120);

export const LINE = timelineOf([
  { id: 'lights', beats: 12 },
  { id: 'crew', beats: 12 },
  { id: 'tools', beats: 8 },
  { id: 'gate', beats: 12 },
  { id: 'chores', beats: 8 },
  { id: 'song', beats: 16 },
  { id: 'dawn', beats: 16 },
  { id: 'end', beats: 12 },
]);

export type ShotId = (typeof LINE.shots)[number]['id'];

/** Each shot's first beat on the film's line. */
export const START = Object.fromEntries(LINE.shots.map((s) => [s.id, LINE.startOf(s.id)])) as Record<ShotId, number>;

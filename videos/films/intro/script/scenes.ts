// The running order: every scene's script, back to back. A scene's start
// is the sum of the ones before it, so lengthening one moves the rest.

import { timelineOf } from '../../../engine/beats/timeline.ts';
import { agents } from './agents.ts';
import { apart } from './apart.ts';
import { chores } from './chores.ts';
import { crew } from './crew.ts';
import { end } from './end.ts';
import { ghost } from './ghost.ts';
import { locked } from './locked.ts';
import { night } from './night.ts';
import { reel } from './reel.ts';
import { reveal } from './reveal.ts';
import { scratch } from './scratch.ts';
import { stamps } from './stamps.ts';
import { terminal } from './terminal.ts';
import { title } from './title.ts';
import type { Script } from './types.ts';

export const SCENES = [ghost, reveal, title, chores, scratch, apart, terminal, agents, crew, night, locked, stamps, reel, end] as const satisfies readonly Script[];

export type SceneId = (typeof SCENES)[number]['id'];

/** The scenes as the engine's beat line: each one a shot. */
export const LINE = timelineOf(SCENES);

/** The whole video, in beats. */
export const TOTAL = LINE.total;

/** A scene's first beat on the whole timeline. */
export const startOf = (id: SceneId) => LINE.startOf(id);

/** The scene playing at [beat], and how far into it. */
export function sceneAt(beat: number): { scene: (typeof SCENES)[number]; local: number } {
  const { shot, local } = LINE.at(beat);
  return { scene: shot, local };
}

// The running order: every scene's script, back to back. A scene's start
// is the sum of the ones before it, so lengthening one moves the rest.

import { agents } from './script/agents.ts';
import { apart } from './script/apart.ts';
import { chores } from './script/chores.ts';
import { crew } from './script/crew.ts';
import { end } from './script/end.ts';
import { ghost } from './script/ghost.ts';
import { locked } from './script/locked.ts';
import { night } from './script/night.ts';
import { reel } from './script/reel.ts';
import { reveal } from './script/reveal.ts';
import { scratch } from './script/scratch.ts';
import { stamps } from './script/stamps.ts';
import { terminal } from './script/terminal.ts';
import { title } from './script/title.ts';
import type { Script } from './script/types.ts';

export const SCENES = [ghost, reveal, title, chores, scratch, apart, terminal, agents, crew, night, locked, stamps, reel, end] as const satisfies readonly Script[];

export type SceneId = (typeof SCENES)[number]['id'];

const STARTS = new Map<string, number>();
let at = 0;
for (const s of SCENES) {
  STARTS.set(s.id, at);
  at += s.beats;
}

/** The whole video, in beats. */
export const TOTAL = at;

/** A scene's first beat on the whole timeline. */
export const startOf = (id: SceneId) => STARTS.get(id) as number;

/** The scene playing at [beat], and how far into it. */
export function sceneAt(beat: number): { scene: (typeof SCENES)[number]; local: number } {
  let start = 0;
  for (const scene of SCENES) {
    if (beat < start + scene.beats) return { scene, local: beat - start };
    start += scene.beats;
  }
  const last = SCENES[SCENES.length - 1];
  return { scene: last, local: beat - (TOTAL - last.beats) };
}

// The whole timeline as the sound side reads it: every scene's sounds and
// music changes moved onto one beat line from the video's start.

import type { Section } from './music.ts';
import { SCENES, startOf, type SceneId } from './scenes.ts';
import type { Cue } from './sfx.ts';
import type { Facts } from './script/types.ts';

export type Placed = Cue & { scene: SceneId };

/** Every sound, in time order, `at` in beats from the start. */
export function soundsOf(facts: Facts): Placed[] {
  return SCENES.flatMap((s) => s.sounds(facts).map((c) => ({ ...c, at: startOf(s.id) + c.at, scene: s.id }))).sort((a, b) => a.at - b.at);
}

/** Where each section of the music starts, `at` in beats from the start; a repeat of the one before is dropped. */
export function sectionsOf(): { at: number; section: Section }[] {
  const all = SCENES.flatMap((s) => {
    const changes: readonly { at: number; section: Section }[] = 'changes' in s ? s.changes : [];
    return [{ at: startOf(s.id), section: s.music as Section }, ...changes.map((c) => ({ at: startOf(s.id) + c.at, section: c.section }))];
  }).sort((a, b) => a.at - b.at);
  return all.filter((s, i) => i === 0 || s.section !== all[i - 1].section);
}

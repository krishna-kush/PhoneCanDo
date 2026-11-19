import type { Mood } from '../../../common/face/mood';

// The drawer key's three bunks (key/Bunks.tsx draws them): the first three
// agents in the drawer's order, each in its mascot's inks with its eyes open
// or shut. Pure (zero RN imports).

/** A mascot's ink in front: red, or amber when its look swaps them (mascot/layout/figure.ts). */
export type Ink = 'red' | 'amber';

/** One bunk: its front ink (its shadow is the other) and whether its eyes are open. */
export type Bunk = { ink: Ink; awake: boolean };

/** One agent as the key needs it, in the drawer's order. */
export type Crew = { name: string; ink: Ink; mood: Mood };

/** The key always has three bunks. */
export const BUNKS = 3;

export function inkOf(look: { swap: boolean }): Ink {
  return look.swap ? 'amber' : 'red';
}

/** Eyes open while an agent works or is on its way up or down; shut while it sleeps or after it failed. */
export function eyesOpen(mood: Mood): boolean {
  return mood === 'awake' || mood === 'thinking' || mood === 'busy';
}

/**
 * Three bunks, top first: the first three agents, each in its own inks; a
 * bunk with no agent sleeps in the other ink from the bunk above (red on
 * top when nobody is in), so the stack always reads as a crew.
 */
export function bunksOf(crew: readonly Crew[]): Bunk[] {
  const bunks: Bunk[] = [];
  for (let i = 0; i < BUNKS; i++) {
    const agent = crew[i];
    const above = bunks[i - 1]?.ink ?? 'amber';
    bunks.push(agent ? { ink: agent.ink, awake: eyesOpen(agent.mood) } : { ink: above === 'red' ? 'amber' : 'red', awake: false });
  }
  return bunks;
}

/** What a screen reader says for the key: what it opens, then who is in the bunks, awake or asleep. */
export function keyLabel(crew: readonly Crew[]): string {
  const beds = crew.slice(0, BUNKS).map((a) => `${a.name} ${eyesOpen(a.mood) ? 'awake' : 'asleep'}`);
  return ['Open the menu: agents, models, settings', ...beds].join('. ');
}

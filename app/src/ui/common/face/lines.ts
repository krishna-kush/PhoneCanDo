// What A-01 says in the app: short mono captions in the site's voice
// (web/src/data/mascot.ts), only ever beside the plain words, never in
// place of them. Pure (zero RN imports).
import type { Mood } from './mood';

const MOOD: Record<Mood, string> = {
  awake: 'on duty',
  busy: 'one sec…',
  asleep: 'zzz · asleep',
  oops: 'ouch · see why',
};

export function moodLine(mood: Mood): string {
  return MOOD[mood];
}

/** Said when the face is tapped; take turns. */
export const BOOPS = ['boop!', 'hi there', 'that tickles', 'still here', 'beep boop', 'ready when u are', 'hehe', 'again?'];

export function boopLine(n: number): string {
  return BOOPS[((n % BOOPS.length) + BOOPS.length) % BOOPS.length];
}

/** Under the loader while an agent starts; one per start. */
export const WAKING = ['waking up', 'stretching', 'coffee first', 'booting brain', 'finding my keys'];

export function wakingLine(seed: number): string {
  return WAKING[Math.abs(Math.floor(seed)) % WAKING.length];
}

/** The drawer's head: "3 agents · 1 awake". */
export function crewLine(total: number, awake: number): string {
  const agents = total === 1 ? '1 agent' : `${total} agents`;
  if (total === 0) return 'nobody home yet';
  return awake === 0 ? `${agents} · all asleep` : `${agents} · ${awake} awake`;
}

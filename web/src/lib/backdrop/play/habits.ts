// What each awake one does on its own, each step, by its trick (kinds.ts),
// when it isn't following you down (follow.ts): the dancer hops to a beat
// and the runner runs, for a while after it was woken or thrown; in the air,
// Maps curves toward the nearest sleeper and Notes drifts side to side; a
// rolling Clock's glyph turns as it goes. Pure: no drawing.

import { floorOf, SIZE, type Toy } from './toys';
import { TRAITS } from './kinds';

/** Seconds a woken or thrown one keeps doing its own thing. */
export const ENERGY = 6;
/** The dancer's beat, seconds, and how high it hops. */
const BEAT = 0.55;
const HOP = 330;
const RUN = 190;
/** How hard Maps turns toward a sleeper, and how fast across it may go. */
const HOMING = 1500;
const HOMING_MOST = 900;
const SWAY = 520;

/** Moves an awake toy by its trick this step, before gravity; [toys] are everyone. */
export function habit(toy: Toy, toys: Toy[], h: number) {
  if (!toy.awake) return;
  const trick = TRAITS[toy.kind].trick;
  if (trick === 'dance' && toy.grounded && toy.energy > 0) {
    toy.beat += h;
    if (toy.beat >= BEAT) {
      toy.beat = 0;
      toy.vy = -HOP;
      toy.squashV -= 2.5;
    }
  } else if (trick === 'run' && toy.grounded && toy.energy > 0) {
    toy.vx = (Math.sign(toy.vx) || 1) * RUN;
    toy.walked += RUN * h;
  } else if (trick === 'home' && !toy.grounded) {
    const target = nearestSleeper(toy, toys);
    if (target) toy.vx = Math.max(-HOMING_MOST, Math.min(HOMING_MOST, toy.vx + Math.sign(target.d - toy.d) * HOMING * h));
  } else if (trick === 'flutter' && !toy.grounded && !toy.climbing && toy.vy > 0) {
    toy.vx += Math.sin(toy.y * 0.045) * SWAY * h;
  }
}

/** Turns a glyph that rolls (Clock, Settings) as far as it went along the deck. */
export function roll(toy: Toy, h: number) {
  const trick = TRAITS[toy.kind].trick;
  if (trick === 'roll' || trick === 'grind') toy.spin += (toy.vx * h) / (SIZE * 0.5);
}

/** Whether one is doing its own thing just now, so the loop keeps its full rate. */
export const busy = (toy: Toy) => toy.awake && toy.energy > 0 && (TRAITS[toy.kind].trick === 'dance' || TRAITS[toy.kind].trick === 'run');

function nearestSleeper(toy: Toy, toys: Toy[]): Toy | null {
  const i = floorOf(toy.y);
  let best: Toy | null = null;
  for (const o of toys) {
    if (o.awake || o.held || o.chute >= 0 || floorOf(o.y) !== i) continue;
    if (!best || Math.abs(o.d - toy.d) < Math.abs(best.d - toy.d)) best = o;
  }
  return best;
}

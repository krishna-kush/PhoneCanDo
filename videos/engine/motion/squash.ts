// How a body moves, as numbers from the time (in beats): hops with their
// crouch and squash, bobbing to the beat, the settle after a landing. Pure.

export type Squash = {
  /** How far it is off the ground, in its own short sides. */
  lift: number;
  sx: number;
  sy: number;
};

export const REST: Squash = { lift: 0, sx: 1, sy: 1 };

/** Settling after a landing: a squash that springs back, [k] in half beats since it landed. */
export function settle(k: number, depth = 1): Squash {
  if (k < 0 || k > 1.5) return REST;
  const d = Math.exp(-7 * k) * Math.cos(k * Math.PI * 3) * depth;
  return { lift: 0, sx: 1 + 0.2 * d, sy: 1 - 0.24 * d };
}

/**
 * A hop leaving the ground at [at] and landing [len] beats later, [height]
 * short sides high at its top: a crouch before, stretched in the air,
 * squashed on landing.
 */
export function hop(t: number, at: number, len: number, height: number, crouch = 0.25): Squash {
  if (t < at - crouch) return REST;
  if (t < at) {
    const c = Math.sin(((t - (at - crouch)) / crouch) * (Math.PI / 2));
    return { lift: 0, sx: 1 + 0.16 * c, sy: 1 - 0.2 * c };
  }
  if (t < at + len) {
    const k = (t - at) / len;
    const speed = Math.abs(1 - 2 * k);
    return { lift: 4 * height * k * (1 - k), sx: 1 - 0.1 * speed, sy: 1 + 0.16 * speed };
  }
  return settle((t - at - len) / 0.5);
}

/** Bobbing to the beat: down on each beat, [height] up between. */
export function bob(beat: number, height = 0.06): Squash {
  const f = beat - Math.floor(beat);
  const down = Math.exp(-9 * f);
  return { lift: height * Math.sin(Math.PI * f), sx: 1 + 0.08 * down, sy: 1 - 0.1 * down };
}

/** Breathing in its sleep: a slow swell, once every [every] beats. */
export function breathe(t: number, every = 4, depth = 0.035): Squash {
  const k = Math.sin((t / every) * Math.PI * 2);
  return { lift: 0, sx: 1 - depth * 0.5 * k, sy: 1 + depth * k };
}

/** Two squashes at once: the lifts add, the stretches multiply. */
export const both = (a: Squash, b: Squash): Squash => ({ lift: a.lift + b.lift, sx: a.sx * b.sx, sy: a.sy * b.sy });

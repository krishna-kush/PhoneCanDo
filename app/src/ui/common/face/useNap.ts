import { useEffect, useState } from 'react';
import type { Mood } from './mood';

/** A napping face's state: up or not, its mood, and the boop that wakes it. */
export type Nap = { up: boolean; mood: Mood; boop: (boops: number) => void };

/** How long a boop keeps a napping face up before it dozes off again. */
const UP_MS = 2400;

/**
 * A face napping until it is booped (BoopFace's onBoop): a tap wakes it,
 * and it stays up until UP_MS after the last tap, then naps again (the
 * face plays both: jolted awake, dozing off). `up` is for its caption.
 */
export function useNap(): Nap {
  const [nap, setNap] = useState({ up: false, boops: 0 });

  useEffect(() => {
    if (!nap.up) return;
    const id = setTimeout(() => setNap((n) => ({ up: false, boops: n.boops })), UP_MS);
    return () => clearTimeout(id);
  }, [nap.up, nap.boops]);

  return {
    up: nap.up,
    mood: nap.up ? 'awake' : 'asleep',
    boop: (boops) => setNap({ up: true, boops }),
  };
}

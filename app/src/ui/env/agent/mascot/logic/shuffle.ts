// Surprise me's shuffle on the Mascot page: random looks flick past on the
// stage, each held a little longer than the last, like a wheel slowing
// down, and it stops on the pick itself. Pure (zero RN imports).

/** How many looks show, the pick last, the first one's time, and how much longer each next one stays. */
const LOOKS = 10;
const FIRST_MS = 45;
const GROW = 1.2;

export type ShuffleTimes = {
  /** When each look shows, in ms after the press; the last is the pick. */
  shows: number[];
  /** When the pick, held a step like the rest, is kept. */
  lands: number;
};

export function shuffleTimes(looks = LOOKS, first = FIRST_MS, grow = GROW): ShuffleTimes {
  const shows: number[] = [];
  let at = 0;
  let hold = first;
  for (let i = 0; i < looks; i++) {
    shows.push(Math.round(at));
    at += hold;
    hold *= grow;
  }
  return { shows, lands: Math.round(at) };
}

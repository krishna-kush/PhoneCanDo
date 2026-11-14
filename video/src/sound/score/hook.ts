// The hook: two bars over Am and F, answered over C and G. Each bar opens
// on the same 3-3-2 rhythm (16ths 0, 3 and 6), so the ear knows it by its
// rhythm before its tune; the answer climbs to B5 and falls back home to
// the A that starts it again.

/** A note of the hook: its 16th in the bar, its MIDI note and how many 16ths it holds. */
export type Note = readonly [step: number, midi: number, len: number];

export const HOOK: readonly (readonly Note[])[] = [
  // Am
  [[0, 81, 3], [3, 76, 3], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 74, 2], [14, 76, 2]],
  // F
  [[0, 72, 3], [3, 69, 3], [6, 72, 2], [8, 74, 2], [10, 76, 1], [11, 74, 1], [12, 72, 4]],
  // C
  [[0, 79, 3], [3, 76, 3], [6, 79, 2], [8, 81, 2], [10, 79, 2], [12, 76, 2], [14, 74, 2]],
  // G
  [[0, 74, 3], [3, 71, 3], [6, 74, 2], [8, 76, 2], [10, 79, 2], [12, 83, 4]],
];

/** The hook's note starting on 16th [step] of its bar [bar] (0 to 3), if one does. */
export const hookAt = (bar: number, step: number): Note | undefined => HOOK[((bar % 4) + 4) % 4].find(([s]) => s === step);

/** The hook note sounding just before 16th [step] of [bar], if it runs right up to it. */
export function hookBefore(bar: number, step: number): Note | undefined {
  const notes = HOOK[((bar % 4) + 4) % 4];
  if (step === 0) {
    const prev = HOOK[(((bar - 1) % 4) + 4) % 4];
    const last = prev[prev.length - 1];
    return last[0] + last[2] === 16 ? last : undefined;
  }
  return notes.find(([s, , len]) => s + len === step);
}

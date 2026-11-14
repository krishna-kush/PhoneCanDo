// A film's running order: its shots back to back. A shot's start is the
// sum of the ones before it, so lengthening one moves the rest.

export type Shot = { id: string; beats: number };

export type Timeline<S extends Shot> = {
  shots: readonly S[];
  /** The whole film, in beats. */
  total: number;
  /** A shot's first beat on the whole line. (A method, so a film's own line with its named shots still passes where any line is asked for.) */
  startOf(id: S['id']): number;
  /** The shot playing at [beat], and how far into it; the last one from the end on. */
  at(beat: number): { shot: S; index: number; local: number };
};

export function timelineOf<const S extends Shot>(shots: readonly S[]): Timeline<S> {
  const starts = new Map<string, number>();
  let total = 0;
  for (const s of shots) {
    if (starts.has(s.id)) throw new Error(`Two shots are called ${s.id}.`);
    starts.set(s.id, total);
    total += s.beats;
  }
  return {
    shots,
    total,
    startOf: (id) => {
      const at = starts.get(id);
      if (at === undefined) throw new Error(`No shot called ${id}.`);
      return at;
    },
    at: (beat) => {
      let start = 0;
      for (let index = 0; index < shots.length; index++) {
        const shot = shots[index];
        if (beat < start + shot.beats) return { shot, index, local: beat - start };
        start += shot.beats;
      }
      const index = shots.length - 1;
      return { shot: shots[index], index, local: beat - (total - shots[index].beats) };
    },
  };
}

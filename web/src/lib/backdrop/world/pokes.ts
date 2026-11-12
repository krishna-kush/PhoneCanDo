// Units answer a click with a hop and a line on a callout, as A-01's caption
// reads. Each frame the units drawn leave their screen boxes here; a press
// finds the last one drawn under it, which is the nearest.

export type Hit = { name: string; serial: string; key: string; x0: number; y0: number; x1: number; y1: number };

/** A line to draw over everything once the frame is done, at a world point. */
export type Said = { text: string; x: number; y: number; z: number };

// Seconds: the hop, and how long the line stays up.
const HOP = 0.55;
const SAY = 1.9;

const QUIET = { hop: null, say: null };

export class Pokes {
  readonly hits: Hit[] = [];
  readonly lines: Said[] = [];
  private said = new Map<string, { at: number; say: string }>();

  clear() {
    this.hits.length = 0;
    this.lines.length = 0;
  }

  add(hit: Hit) {
    this.hits.push(hit);
  }

  find(x: number, y: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h;
    }
    return null;
  }

  poke(name: string, now: number, say: string) {
    this.said.set(name, { at: now, say });
  }

  /** How far through its hop a unit is (null when it isn't hopping), and its line. */
  state(name: string, now: number): { hop: number | null; say: string | null } {
    const p = this.said.get(name);
    if (!p) return QUIET;
    const age = now - p.at;
    if (age > SAY) {
      this.said.delete(name);
      return QUIET;
    }
    return { hop: age < HOP ? age / HOP : null, say: p.say };
  }
}

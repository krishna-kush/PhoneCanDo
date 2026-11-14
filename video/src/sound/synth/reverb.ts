// A small room, Freeverb's way: eight damped combs and four allpasses a
// side, the right side's lines a little longer so the two never match.

import { SR } from '../rate.ts';

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const SPREAD = 23;
/** Freeverb's tunings are for 44.1 kHz. */
const SCALE = SR / 44100;
const INPUT = 0.015;

const flush = (v: number) => (v > -1e-20 && v < 1e-20 ? 0 : v);

class Comb {
  buf: Float32Array;
  i = 0;
  z = 0;

  constructor(n: number) {
    this.buf = new Float32Array(n);
  }

  run(x: number, fb: number, damp: number): number {
    const y = this.buf[this.i];
    this.z = flush(y * (1 - damp) + this.z * damp);
    this.buf[this.i] = x + this.z * fb;
    this.i = (this.i + 1) % this.buf.length;
    return y;
  }

  reset() {
    this.buf.fill(0);
    this.z = 0;
    this.i = 0;
  }
}

class Allpass {
  buf: Float32Array;
  i = 0;

  constructor(n: number) {
    this.buf = new Float32Array(n);
  }

  run(x: number): number {
    const b = this.buf[this.i];
    this.buf[this.i] = flush(x + b * 0.5);
    this.i = (this.i + 1) % this.buf.length;
    return b - x;
  }

  reset() {
    this.buf.fill(0);
    this.i = 0;
  }
}

const lines = (tunings: readonly number[], extra: number) => tunings.map((t) => Math.round((t + extra) * SCALE));

export class Reverb {
  combs: Comb[][];
  allpasses: Allpass[][];
  fb: number;
  damp: number;

  /** [room] 0 small to 1 large, [damp] 0 bright to 1 dull. */
  constructor(room: number, damp: number) {
    this.combs = [0, SPREAD].map((x) => lines(COMBS, x).map((n) => new Comb(n)));
    this.allpasses = [0, SPREAD].map((x) => lines(ALLPASSES, x).map((n) => new Allpass(n)));
    this.fb = room * 0.28 + 0.7;
    this.damp = damp * 0.4;
  }

  /** Adds the room's answer to [input] into [out], over samples [from, to). */
  process(input: { l: Float32Array; r: Float32Array }, out: { l: Float32Array; r: Float32Array }, from: number, to: number) {
    const [cl, cr] = this.combs;
    const [al, ar] = this.allpasses;
    for (let k = from; k < to; k++) {
      const x = (input.l[k] + input.r[k]) * INPUT;
      let yl = 0;
      let yr = 0;
      for (let c = 0; c < cl.length; c++) {
        yl += cl[c].run(x, this.fb, this.damp);
        yr += cr[c].run(x, this.fb, this.damp);
      }
      for (let a = 0; a < al.length; a++) {
        yl = al[a].run(yl);
        yr = ar[a].run(yr);
      }
      out.l[k] += yl;
      out.r[k] += yr;
    }
  }

  reset() {
    for (const side of this.combs) for (const c of side) c.reset();
    for (const side of this.allpasses) for (const a of side) a.reset();
  }
}

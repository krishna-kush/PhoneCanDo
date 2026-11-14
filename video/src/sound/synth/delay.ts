// A ping-pong delay: each echo crosses to the other side, a little darker
// than the last.

export class PingPong {
  l: Float32Array;
  r: Float32Array;
  i = 0;
  fb: number;
  damp: number;
  zl = 0;
  zr = 0;

  /** Echoes [time] samples apart, each [fb] of the last, darkened by [damp] (0 bright to 1 dull). */
  constructor(time: number, fb: number, damp: number) {
    this.l = new Float32Array(time);
    this.r = new Float32Array(time);
    this.fb = fb;
    this.damp = damp;
  }

  /** Adds the echoes of [input] into [out], over samples [from, to). */
  process(input: { l: Float32Array; r: Float32Array }, out: { l: Float32Array; r: Float32Array }, from: number, to: number) {
    const n = this.l.length;
    for (let k = from; k < to; k++) {
      const dl = this.l[this.i];
      const dr = this.r[this.i];
      this.zl = dl + (this.zl - dl) * this.damp;
      this.zr = dr + (this.zr - dr) * this.damp;
      if (this.zl > -1e-20 && this.zl < 1e-20) this.zl = 0;
      if (this.zr > -1e-20 && this.zr < 1e-20) this.zr = 0;
      this.l[this.i] = (input.l[k] + input.r[k]) * 0.5 + this.zr * this.fb;
      this.r[this.i] = this.zl * this.fb;
      out.l[k] += dl;
      out.r[k] += dr;
      this.i = (this.i + 1) % n;
    }
  }

  reset() {
    this.l.fill(0);
    this.r.fill(0);
    this.zl = this.zr = 0;
    this.i = 0;
  }
}

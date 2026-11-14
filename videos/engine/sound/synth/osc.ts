// An oscillator that keeps its own phase, so a voice can bend its pitch
// sample by sample. Saw and pulse are band-limited with polyBLEP, so a high
// note doesn't alias into a whine.

import { SR } from '../rate.ts';

const TAU = Math.PI * 2;

/** The polyBLEP correction near a step, for phase [t] moving [dt] a sample. */
function blep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export class Osc {
  phase: number;

  constructor(phase = 0) {
    this.phase = phase;
  }

  advance(dt: number) {
    this.phase += dt;
    this.phase -= Math.floor(this.phase);
  }

  sine(f: number): number {
    const v = Math.sin(TAU * this.phase);
    this.advance(f / SR);
    return v;
  }

  tri(f: number): number {
    const t = this.phase;
    const v = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
    this.advance(f / SR);
    return v;
  }

  saw(f: number): number {
    const dt = f / SR;
    const t = this.phase;
    const v = 2 * t - 1 - blep(t, dt);
    this.advance(dt);
    return v;
  }

  /** A pulse high for [duty] of its cycle, with its DC taken out. */
  pulse(f: number, duty: number): number {
    const dt = f / SR;
    const t = this.phase;
    let v = t < duty ? 1 : -1;
    v += blep(t, dt);
    let u = t - duty;
    if (u < 0) u += 1;
    v -= blep(u, dt);
    this.advance(dt);
    return v - (2 * duty - 1);
  }
}

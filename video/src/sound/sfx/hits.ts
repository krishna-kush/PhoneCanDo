// Things landing hard: the drop's impact, a word slammed down, a rubber
// stamp. Each gets a little room so it sits in the same space as the music.

import { SR } from '../rate.ts';
import { Biquad } from '../synth/biquad.ts';
import { ad } from '../synth/env.ts';
import { Osc } from '../synth/osc.ts';
import { ratio } from '../synth/pitch.ts';
import { rand } from '../synth/rand.ts';
import { Reverb } from '../synth/reverb.ts';
import { crush, drive } from '../synth/shape.ts';
import { stereo, type Stereo } from '../synth/stereo.ts';
import { sides } from './sample.ts';
import type { SfxFn } from './types.ts';

/** [dry] with a small room's answer to [send] added, at [wet]. */
function room(dry: Stereo, send: Stereo, wet: number, size = 0.5): Stereo {
  const out = stereo(dry.l.length);
  new Reverb(size, 0.4).process(send, out, 0, dry.l.length);
  for (let i = 0; i < dry.l.length; i++) {
    dry.l[i] += out.l[i] * wet;
    dry.r[i] += out.r[i] * wet;
  }
  return dry;
}

/** A sub boom diving to its floor, a thump, a crash of bright noise each side its own, a click, a room. */
export const impact: SfxFn = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const a = rand(noise);
  const b = rand(noise + 1);
  const hpl = new Biquad().set('hp', 1800, 0.7);
  const hpr = new Biquad().set('hp', 1800, 0.7);
  const lpl = new Biquad().set('lp', 9000, 0.7);
  const lpr = new Biquad().set('lp', 9000, 0.7);
  const thump = new Osc();
  const dur = 1.6;
  const send = stereo(Math.round(dur * SR));
  let phase = 0;
  const dry = sides(
    dur,
    (t, i, lr) => {
      phase += ((38 + 70 * Math.exp(-t / 0.07)) * k) / SR;
      const sub = drive(Math.sin(2 * Math.PI * phase) * ad(t, 0.001, 0.42), 1.8);
      const mid = thump.sine(150 * k) * ad(t, 0.0005, 0.06);
      const env = ad(t, 0.001, 0.32);
      const cl = lpl.run(hpl.run(a() * 2 - 1)) * env;
      const cr = lpr.run(hpr.run(b() * 2 - 1)) * env;
      const click = (a() * 2 - 1) * Math.exp(-t / 0.0015);
      send.l[i] = mid + cl;
      send.r[i] = mid + cr;
      lr[0] = sub * 0.75 + mid * 0.7 + cl * 0.6 + click * 0.3;
      lr[1] = sub * 0.75 + mid * 0.7 + cr * 0.6 + click * 0.3;
    },
    0.03,
  );
  return room(dry, send, 0.6, 0.6);
};

/** A punchy thud and a crushed crack: a word coming down. */
export const slam: SfxFn = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const r = rand(noise);
  const bp = new Biquad().set('bp', 1400 * k, 0.8);
  let phase = 0;
  return sides(0.3, (t, _, lr) => {
    phase += ((55 + 105 * Math.exp(-t / 0.03)) * k) / SR;
    const thud = drive(Math.sin(2 * Math.PI * phase) * ad(t, 0.0005, 0.08), 2.5);
    const crack = crush(bp.run(r() * 2 - 1) * Math.exp(-t / 0.04) * 1.8, 6) * 0.6;
    lr[0] = thud + crack;
    lr[1] = thud + crack;
  });
};

/** A rubber stamp: a low thud, the paper's slap, and the stamp settling. */
export const stamp: SfxFn = ({ pitch, noise }) => {
  const k = ratio(pitch);
  const r = rand(noise);
  const slap = new Biquad().set('bp', 2600 * k, 0.7);
  const settle = new Biquad().set('bp', 3200 * k, 1.2);
  const dur = 0.32;
  const send = stereo(Math.round(dur * SR));
  let phase = 0;
  const dry = sides(dur, (t, i, lr) => {
    phase += ((70 + 40 * Math.exp(-t / 0.02)) * k) / SR;
    const thud = Math.sin(2 * Math.PI * phase) * ad(t, 0.0005, 0.05);
    const paper = slap.run(r() * 2 - 1) * ad(t, 0.0003, 0.022) * 2;
    const after = t > 0.04 ? settle.run(r() * 2 - 1) * Math.exp(-(t - 0.04) / 0.006) * 0.5 : 0;
    const v = thud + paper + after;
    send.l[i] = send.r[i] = paper;
    lr[0] = v;
    lr[1] = v;
  });
  return room(dry, send, 0.3, 0.3);
};

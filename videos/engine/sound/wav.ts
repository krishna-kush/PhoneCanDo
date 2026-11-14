// WAV files: 24-bit PCM with a little triangular dither for the master,
// 32-bit float for stems that may sit over full scale.

import { writeFileSync } from 'node:fs';
import { SR } from './rate.ts';
import { rand } from './synth/rand.ts';
import type { Stereo } from './synth/stereo.ts';

export type Format = 'pcm24' | 'float32';

export function wav(s: Stereo, format: Format): Buffer {
  const n = s.l.length;
  const bytes = format === 'pcm24' ? 3 : 4;
  const float = format === 'float32';
  const fact = float ? 12 : 0;
  const data = n * 2 * bytes;
  const buf = Buffer.alloc(44 + fact + data);
  let o = 0;
  const str = (v: string) => {
    buf.write(v, o, 'ascii');
    o += 4;
  };
  const u32 = (v: number) => {
    buf.writeUInt32LE(v, o);
    o += 4;
  };
  const u16 = (v: number) => {
    buf.writeUInt16LE(v, o);
    o += 2;
  };
  str('RIFF');
  u32(36 + fact + data);
  str('WAVE');
  str('fmt ');
  u32(16);
  u16(float ? 3 : 1);
  u16(2);
  u32(SR);
  u32(SR * 2 * bytes);
  u16(2 * bytes);
  u16(bytes * 8);
  if (float) {
    str('fact');
    u32(4);
    u32(n);
  }
  str('data');
  u32(data);
  if (float) {
    for (let i = 0; i < n; i++) {
      buf.writeFloatLE(s.l[i], o);
      buf.writeFloatLE(s.r[i], o + 4);
      o += 8;
    }
    return buf;
  }
  const r = rand(0x5eed);
  const full = 8388607;
  for (let i = 0; i < n; i++) {
    for (const x of [s.l[i], s.r[i]]) {
      const dither = r() - r();
      const v = Math.max(-full - 1, Math.min(full, Math.round(x * full + dither)));
      buf.writeIntLE(v, o, 3);
      o += 3;
    }
  }
  return buf;
}

export const writeWav = (path: string, s: Stereo, format: Format) => writeFileSync(path, wav(s, format));

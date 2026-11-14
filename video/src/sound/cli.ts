// pnpm sound: renders the soundtrack from the timeline into out/audio/:
// music.wav and sfx.wav (stems at the mix's level, 32-bit float) and
// mix.wav (the master, 24-bit).

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadFacts } from '../facts/load.ts';
import { OUT } from '../facts/repo.ts';
import { BEAT } from '../timeline/tempo.ts';
import { TOTAL } from '../timeline/scenes.ts';
import { db } from './mix/truepeak.ts';
import { render } from './render.ts';
import { writeWav } from './wav.ts';

const started = performance.now();
const track = render(loadFacts());
const dir = join(OUT, 'audio');
mkdirSync(dir, { recursive: true });
writeWav(join(dir, 'music.wav'), track.music, 'float32');
writeWav(join(dir, 'sfx.wav'), track.sfx, 'float32');
writeWav(join(dir, 'mix.wav'), track.mix, 'pcm24');
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `sound: ${(TOTAL * BEAT).toFixed(2)} s at ${track.lufs.toFixed(1)} LUFS, true peak ${db(track.peak).toFixed(2)} dBTP, in ${seconds} s -> ${dir}`,
);

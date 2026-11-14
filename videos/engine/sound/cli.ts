// pnpm sound <film>: renders a film's soundtrack from its `sound`
// (films/<film>/sound.ts). The master goes where the picture plays it from,
// public/<film>/mix.wav (24-bit); the stems, at the mix's level, go to
// out/<film>/audio/ as music.wav and effects.wav (32-bit float), for a
// listen on their own.

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { secondsOf } from '../beats/tempo.ts';
import { FILMS, OUT, PUBLIC } from '../paths.ts';
import { db } from './master/truepeak.ts';
import type { Sound } from './sound.ts';
import { soundtrack } from './soundtrack.ts';
import { writeWav } from './wav.ts';

const film = process.argv[2];
const source = join(FILMS, film ?? '', 'sound.ts');
if (!film || !existsSync(source)) {
  console.error(film ? `sound: there is no films/${film}/sound.ts` : 'sound: which film? pnpm sound <film>');
  process.exit(1);
}

const started = performance.now();
const { sound } = (await import(pathToFileURL(source).href)) as { sound?: Sound };
if (!sound) {
  console.error(`sound: films/${film}/sound.ts has no \`sound\` export`);
  process.exit(1);
}
const track = soundtrack(sound);
const mix = join(PUBLIC, film, 'mix.wav');
const stems = join(OUT, film, 'audio');
mkdirSync(join(PUBLIC, film), { recursive: true });
mkdirSync(stems, { recursive: true });
writeWav(mix, track.mix, 'pcm24');
writeWav(join(stems, 'music.wav'), track.music, 'float32');
writeWav(join(stems, 'effects.wav'), track.effects, 'float32');
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `sound: ${secondsOf(sound.tempo, sound.beats).toFixed(2)} s at ${track.lufs.toFixed(1)} LUFS, true peak ${db(track.peak).toFixed(2)} dBTP, in ${seconds} s -> ${mix} (stems in ${stems})`,
);

// pnpm stills <film> b12,gate+2,3.5 [--format 16x9]
// pnpm stills <film> --strip gate..gate+4 [--strip …] [--n 8] [--cols 4] [--format 16x9]
//
// Stills: a full-size PNG of each moment in out/<film>/stills/<format>/.
// A strip: [n] frames spread evenly from one moment to another, half size
// with the beat burnt into a corner, laid side by side in one picture in
// out/<film>/strips/<format>/, to read a move without rendering it; several
// --strip in one run share the bundle and the browser. A moment is a beat
// (b12.5), a shot's name (gate, gate+2) or seconds.

import { getCompositions, renderFrames } from '@remotion/renderer';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { secondsOf } from '../beats/tempo.ts';
import { isFormat } from '../stage/formats.ts';
import { beatLineOf } from './beatline.ts';
import { openChrome, patiently } from './browser.ts';
import { bundleFilms, scratch } from './bundle.ts';
import { compositionId } from './film.ts';
import type { RenderProps } from './Films.tsx';
import { beatLabel, beatOf } from './moments.ts';
import { filmArg, OUT } from '../paths.ts';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    format: { type: 'string', default: '16x9' },
    strip: { type: 'string', multiple: true },
    n: { type: 'string', default: '8' },
    cols: { type: 'string', default: '4' },
  },
});

const film = filmArg(positionals[0]);
const format = opt.format;
if (!isFormat(format)) throw new Error(`No format ${format}.`);
const beats = await beatLineOf(film);

/** A strip's beats: [n] from one moment to another. */
function stripBeats(span: string): number[] {
  const [from, to] = span.split('..').map((m) => beatOf(m, beats));
  const n = Math.max(2, Number(opt.n));
  if (to === undefined || !(to > from)) throw new Error('--strip takes two moments, the first before the second: gate..gate+4');
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}

const strips = (opt.strip ?? []).map(stripBeats);
if (strips.length === 0 && !positionals[1]) throw new Error('Which moments? b12,gate+2,3.5 or --strip gate..gate+4');
const stills = strips.length === 0 ? positionals[1].split(',').map((m) => beatOf(m, beats)) : [];

const tmp = scratch();
const serveUrl = await bundleFilms();
const browser = await openChrome();
const inputProps: RenderProps = strips.length > 0 ? { hud: true } : {};
try {
  const composition = (await patiently('The page', () => getCompositions(serveUrl, { inputProps, puppeteerInstance: browser }))).find((c) => c.id === compositionId(film, format));
  if (!composition) throw new Error(`${film} is not made in ${format}.`);
  const frameOf = (beat: number) => Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(secondsOf(beats.tempo, beat) * composition.fps)));

  /** Draws [moments]; each one's picture by its frame. */
  const draw = async (moments: readonly number[], strip: boolean): Promise<Map<number, Buffer>> => {
    const shots = new Map<number, Buffer>();
    await renderFrames({
      composition,
      serveUrl,
      inputProps,
      frames: [...new Set(moments.map(frameOf))].sort((a, b) => a - b),
      outputDir: null,
      ...(strip ? { imageFormat: 'jpeg' as const, jpegQuality: 88 } : { imageFormat: 'png' as const }),
      scale: strip ? 0.5 : 1,
      concurrency: 1,
      muted: true,
      puppeteerInstance: browser,
      onStart: () => {},
      onFrameUpdate: () => {},
      onFrameBuffer: (buffer, frame) => {
        shots.set(frame, buffer);
      },
    });
    return shots;
  };

  for (const moments of strips) {
    const shots = await draw(moments, true);
    const dir = join(OUT, film, 'strips', format);
    const work = join(tmp, 'strip');
    mkdirSync(dir, { recursive: true });
    mkdirSync(work, { recursive: true });
    moments.forEach((beat, i) => writeFileSync(join(work, `${String(i).padStart(3, '0')}.jpg`), shots.get(frameOf(beat))!));
    const cols = Math.max(1, Number(opt.cols));
    const rows = Math.ceil(moments.length / cols);
    const out = join(dir, `${beatLabel(moments[0])}-${beatLabel(moments[moments.length - 1])}.png`);
    const tiled = spawnSync(
      'ffmpeg',
      ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '1', '-i', join(work, '%03d.jpg'), '-vf', `tile=${cols}x${rows}:padding=6:color=0x777777`, '-frames:v', '1', out],
      { encoding: 'utf8' },
    );
    rmSync(work, { recursive: true, force: true });
    if (tiled.status !== 0) throw new Error(`ffmpeg could not lay the strip out: ${tiled.stderr.slice(-800)}`);
    console.log(`strip: ${out} (${moments.length} frames, beats ${moments.map((b) => Number(b.toFixed(2))).join(' ')})`);
  }

  if (stills.length > 0) {
    const shots = await draw(stills, false);
    const dir = join(OUT, film, 'stills', format);
    mkdirSync(dir, { recursive: true });
    for (const beat of stills) {
      const out = join(dir, `${beatLabel(beat)}.png`);
      writeFileSync(out, shots.get(frameOf(beat))!);
      console.log(`still: ${out}`);
    }
  }
} finally {
  await browser.close({ silent: true });
}

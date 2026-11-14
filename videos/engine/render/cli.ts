// pnpm render <film> [--format 16x9]… [--draft] [--shot gate]
//             [--from b12 --to gate+4] [--workers n]
//
// Renders a film through Remotion into out/<film>/<film>-<format>.mp4,
// its sound under it (made first when public/ has none). With no --format,
// every format the film is made in. --draft is 30 fps at half size into
// out/<film>/draft/, fast. --shot, or --from and --to, render only that
// stretch: a moment is a beat (b12.5), a shot's name (gate, gate+2) or
// seconds.

import { getCompositions, renderMedia } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { secondsOf } from '../beats/tempo.ts';
import { isFormat, type FormatId } from '../stage/formats.ts';
import { beatLineOf } from './beatline.ts';
import { openChrome, patiently } from './browser.ts';
import { bundleFilms, scratch } from './bundle.ts';
import { compositionId } from './film.ts';
import type { RenderProps } from './Films.tsx';
import { beatLabel, beatOf, shotSpan } from './moments.ts';
import { filmArg, OUT } from '../paths.ts';
import { ensureSound } from './sound.ts';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    format: { type: 'string', multiple: true },
    draft: { type: 'boolean', default: false },
    shot: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    workers: { type: 'string' },
  },
});

/** The picture's quality: what we post, and a fast look. */
const FINAL = { crf: 16, x264Preset: 'medium', jpegQuality: 95, scale: 1 } as const;
const DRAFT = { crf: 24, x264Preset: 'veryfast', jpegQuality: 80, scale: 0.5 } as const;
const DRAFT_FPS = 30;

const film = filmArg(positionals[0]);
const beats = await beatLineOf(film);
const span = opt.shot
  ? shotSpan(opt.shot, beats)
  : { from: opt.from ? beatOf(opt.from, beats) : 0, to: opt.to ? beatOf(opt.to, beats) : beats.line.total };
const whole = span.from <= 0 && span.to >= beats.line.total;
const quality = opt.draft ? DRAFT : FINAL;
const inputProps: RenderProps = opt.draft ? { fps: DRAFT_FPS } : {};
const workers = Math.max(1, Number(opt.workers ?? Math.floor(availableParallelism() / 3)));
const dir = join(OUT, film, opt.draft ? 'draft' : '');
mkdirSync(dir, { recursive: true });

scratch();
ensureSound(film);
const serveUrl = await bundleFilms();
const browser = await openChrome();
try {
  const made = (await patiently('The page', () => getCompositions(serveUrl, { inputProps, puppeteerInstance: browser }))).filter((c) => c.id.startsWith(`${film}-`));
  const formats = (opt.format ?? made.map((c) => c.id.slice(film.length + 1))).map((f) => {
    if (!isFormat(f) || !made.some((c) => c.id === compositionId(film, f))) {
      throw new Error(`${film} is not made in ${f}; it is made in ${made.map((c) => c.id.slice(film.length + 1)).join(', ')}.`);
    }
    return f;
  });
  for (const format of formats) await video(format, made.find((c) => c.id === compositionId(film, format))!);
} finally {
  await browser.close({ silent: true });
}

async function video(format: FormatId, composition: Awaited<ReturnType<typeof getCompositions>>[number]) {
  const first = Math.max(0, Math.round(secondsOf(beats.tempo, span.from) * composition.fps));
  const last = Math.min(composition.durationInFrames, Math.round(secondsOf(beats.tempo, span.to) * composition.fps)) - 1;
  if (last < first) throw new Error(`Nothing to render between ${span.from} and ${span.to} beats.`);
  const out = join(dir, `${film}-${format}${whole ? '' : `-${beatLabel(span.from)}-${beatLabel(span.to)}`}.mp4`);
  const started = Date.now();
  let said = 0;
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: 'h264',
    outputLocation: out,
    overwrite: true,
    frameRange: whole ? null : [first, last],
    imageFormat: 'jpeg',
    jpegQuality: quality.jpegQuality,
    crf: quality.crf,
    x264Preset: quality.x264Preset,
    scale: quality.scale,
    colorSpace: 'bt709',
    audioBitrate: '320k',
    concurrency: workers,
    puppeteerInstance: browser,
    onProgress: ({ renderedFrames, encodedFrames }) => {
      const now = Date.now();
      if (now - said < 5000) return;
      said = now;
      const rate = renderedFrames / ((now - started) / 1000);
      console.log(`${format}: ${renderedFrames}/${last - first + 1} drawn, ${encodedFrames} encoded (${rate.toFixed(1)} a second)`);
    },
  });
  console.log(`${format}: ${out} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}

// pnpm render [--format 16x9|9x16|1x1] [--draft] [--from s] [--to s]
//             [--workers n] [--capture jpeg|png] [--stills t,t,...]
//             [--thumbnail] [--remux] [--splice --from s --to s]
//             [--look night|stage|dots|paper|day]
//
// Draws the page frame by frame in headless Chrome and encodes it with
// ffmpeg into out/phonecando-intro-<format>.mp4 with the mix from `pnpm
// sound` (out/audio/) under it. --draft
// is 30 fps at half size, fast; --stills writes PNGs at those seconds (or
// beats, as b16) instead; --thumbnail only writes YouTube's thumbnail,
// which a whole 16:9 render writes too; --remux lays the sound from a new
// `pnpm sound` under the videos already made, drawing nothing; --splice
// draws only --from to --to again in the videos already made and sets it
// in by frame (the video is encoded once more, the sound kept).

import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join as joinPath } from 'node:path';
import { parseArgs } from 'node:util';
import { OUT } from '../facts/repo.ts';
import { startOf, TOTAL } from '../timeline/scenes.ts';
import { BEAT } from '../timeline/tempo.ts';
import { DRAFT, FINAL, ffmpeg, join, MEND, remux, type Quality } from './encode.ts';
import { FORMATS, isFormat, type FormatId } from './formats.ts';
import { renderShare, renderStills } from './frames.ts';
import { serve } from './serve.ts';
import { fpsOf, framesOf, splice } from './splice.ts';

const { values: opt } = parseArgs({
  options: {
    format: { type: 'string', multiple: true },
    draft: { type: 'boolean', default: false },
    from: { type: 'string' },
    to: { type: 'string' },
    workers: { type: 'string' },
    stills: { type: 'string' },
    capture: { type: 'string', default: 'jpeg' },
    thumbnail: { type: 'boolean', default: false },
    remux: { type: 'boolean', default: false },
    splice: { type: 'boolean', default: false },
    look: { type: 'string' },
  },
});

const formats = (opt.format ?? Object.keys(FORMATS)).map((f) => {
  if (!isFormat(f)) throw new Error(`No format ${f}; there are ${Object.keys(FORMATS).join(', ')}.`);
  return f;
});
const seconds = (v: string) => (v.startsWith('b') ? Number(v.slice(1)) * BEAT : Number(v));
/** Beats into the title for the thumbnail: A-01 landed, the squiggle drawn. */
const THUMB = 1.9;
const length = TOTAL * BEAT;
// This run's own scratch (Chrome profiles, pieces), so two runs never clear each other's.
const work = joinPath(OUT, '.work', String(process.pid));
mkdirSync(work, { recursive: true });

const server = await serve();
const pageUrl = (f: FormatId) => `${server.origin}/video/src/picture/index.html?format=${f}&render=1${opt.look ? `&look=${opt.look}` : ''}`;

try {
  if (opt.stills) await stills(opt.stills.split(',').map((s) => s.trim()));
  else if (opt.thumbnail) await thumbnail();
  else if (opt.remux) for (const f of formats) await resound(f);
  else if (opt.splice) for (const f of formats) await mend(f);
  else for (const f of formats) await video(f);
} finally {
  await server.close();
  rmSync(work, { recursive: true, force: true });
}

async function stills(at: string[]) {
  for (const f of formats) {
    const dir = joinPath(OUT, 'stills', f, opt.look ?? '');
    mkdirSync(dir, { recursive: true });
    const shots = await renderStills(pageUrl(f), FORMATS[f].w, FORMATS[f].h, at.map(seconds), work);
    shots.forEach((png, i) => writeFileSync(joinPath(dir, `${at[i].replace('.', '_')}.png`), png));
    console.log(`${f}: ${shots.length} stills in ${dir}`);
  }
}

/** Frames [first, last) of [f] drawn by the workers in parallel, each share its own piece; the pieces in order. */
async function drawFrames(f: FormatId, first: number, last: number, fps: number, quality: Quality, scale: number): Promise<string[]> {
  const { w, h } = FORMATS[f];
  const workers = Math.max(1, Math.min(Number(opt.workers ?? Math.max(1, Math.floor(availableParallelism() / 3))), last - first));
  let done = 0;
  const started = Date.now();
  const report = setInterval(() => {
    const rate = done / ((Date.now() - started) / 1000);
    console.log(`${f}: ${done}/${last - first} frames (${rate.toFixed(1)} a second)`);
  }, 5000);
  const each = Math.ceil((last - first) / workers);
  const parts = Array.from({ length: workers }, (_, i) => ({
    from: first + i * each,
    to: Math.min(last, first + (i + 1) * each),
    out: joinPath(work, `${f}-${i}.mp4`),
  })).filter((p) => p.to > p.from);
  try {
    await Promise.all(
      parts.map((p) =>
        renderShare({ url: pageUrl(f), width: w, height: h, scale, fps, ...p, work, quality, capture: opt.capture === 'png' ? 'png' : 'jpeg', tick: () => done++ }),
      ),
    );
  } finally {
    clearInterval(report);
  }
  return parts.map((p) => p.out);
}

async function video(f: FormatId) {
  const fps = opt.draft ? 30 : 60;
  const first = Math.round(seconds(opt.from ?? '0') * fps);
  const last = Math.round(Math.min(length, seconds(opt.to ?? String(length))) * fps);
  const dir = opt.draft ? joinPath(OUT, 'draft') : OUT;
  mkdirSync(dir, { recursive: true });
  const started = Date.now();
  const parts = await drawFrames(f, first, last, fps, opt.draft ? DRAFT : FINAL, opt.draft ? 0.5 : 1);

  const whole = first === 0 && last === Math.round(length * fps);
  const mix = joinPath(OUT, 'audio', 'mix.wav');
  const audio = existsSync(mix) ? mix : null;
  if (!audio) console.log(`${f}: no sound laid (no ${mix}; run pnpm sound).`);
  const out = joinPath(dir, `phonecando-intro-${f}${whole ? '' : `-${first}-${last}`}.mp4`);
  await join(parts, joinPath(work, `${f}.txt`), out, audio, first / fps);
  console.log(`${f}: ${out} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  if (whole && f === '16x9' && !opt.draft) await thumbnail();
}

/** The finished [f] video with the sound laid again from out/audio/. */
async function resound(f: FormatId) {
  const out = joinPath(OUT, `phonecando-intro-${f}.mp4`);
  const mix = joinPath(OUT, 'audio', 'mix.wav');
  if (!existsSync(out) || !existsSync(mix)) return console.log(`${f}: nothing to remux (needs ${out} and ${mix}).`);
  const fresh = joinPath(work, `${f}.mp4`);
  await remux(out, mix, fresh);
  renameSync(fresh, out);
  console.log(`${f}: ${out} (sound laid again)`);
}

/** The finished [f] video with --from to --to drawn again and set in by frame. */
async function mend(f: FormatId) {
  const out = joinPath(OUT, `phonecando-intro-${f}.mp4`);
  if (!existsSync(out)) return console.log(`${f}: nothing to splice into (no ${out}).`);
  const fps = fpsOf(out);
  const total = framesOf(out);
  const first = Math.round(seconds(opt.from ?? '0') * fps);
  const last = Math.min(total, Math.round(seconds(opt.to ?? String(length)) * fps));
  const started = Date.now();
  const fresh = await drawFrames(f, first, last, fps, FINAL, 1);
  const mended = joinPath(work, `${f}-mended.mp4`);
  await splice(out, fps, first, last, total, fresh, MEND, mended);
  const got = framesOf(mended);
  if (got !== total) throw new Error(`${f}: the splice came out ${got} frames, not ${total}; ${out} is left as it was.`);
  renameSync(mended, out);
  console.log(`${f}: ${out} (frames ${first} to ${last} drawn again, ${((Date.now() - started) / 1000).toFixed(0)} s)`);
}

/** YouTube's 1280 x 720 thumbnail: the drop, A-01 landed on the verb. */
async function thumbnail() {
  const [png] = await renderStills(pageUrl('16x9'), FORMATS['16x9'].w, FORMATS['16x9'].h, [(startOf('title') + THUMB) * BEAT], work);
  const full = joinPath(work, 'thumbnail-full.png');
  writeFileSync(full, png);
  const out = joinPath(OUT, 'phonecando-intro-thumbnail.png');
  await ffmpeg(['-i', full, '-vf', 'scale=1280:720:flags=lanczos', out]);
  console.log(`thumbnail: ${out}`);
}

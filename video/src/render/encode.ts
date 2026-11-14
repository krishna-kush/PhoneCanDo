// ffmpeg's side: frames in, H.264 out, then the pieces joined and the
// sound laid under. Chrome's pictures are sRGB; the video is tagged and
// converted as BT.709 limited range, what every platform expects.

import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import type { Readable, Writable } from 'node:stream';

export type Quality = { crf: number; preset: string };

export const FINAL: Quality = { crf: 16, preset: 'medium' };
export const DRAFT: Quality = { crf: 24, preset: 'veryfast' };
/** A mend encodes the untouched frames a second time, so a little finer. */
export const MEND: Quality = { crf: 14, preset: 'medium' };

const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/** The H.264 every piece of a video is encoded with, so pieces join. */
export const x264 = (fps: number, q: Quality) => [
  ...['-c:v', 'libx264', '-preset', q.preset, '-crf', String(q.crf), '-tune', 'animation', '-profile:v', 'high', '-pix_fmt', 'yuv420p'],
  ...['-g', String(fps * 2), ...BT709],
];

export type Capture = 'png' | 'jpeg';

/**
 * An ffmpeg that takes [capture] frames on its stdin and writes [out]. A
 * PNG is sRGB; Chrome's JPEG is full-range BT.601 YUV, said so for the
 * conversion.
 */
export function frameSink(out: string, fps: number, q: Quality, capture: Capture): ChildProcessByStdio<Writable, null, Readable> {
  const from = capture === 'jpeg' ? 'in_color_matrix=bt601:in_range=full:' : '';
  return spawn(
    'ffmpeg',
    [
      ...['-y', '-hide_banner', '-loglevel', 'error'],
      ...['-f', 'image2pipe', '-framerate', String(fps), '-c:v', capture === 'jpeg' ? 'mjpeg' : 'png', '-i', '-'],
      ...['-vf', `scale=${from}out_color_matrix=bt709:out_range=tv,format=yuv420p`],
      ...x264(fps, q),
      out,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );
}

/** Runs ffmpeg with [args]; rejects with its last words when it fails. */
export function ffmpeg(args: string[]): Promise<void> {
  return new Promise((done, fail) => {
    const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('exit', (code) => (code === 0 ? done() : fail(new Error(`ffmpeg failed (${code}): ${err.slice(-1500)}`))));
  });
}

const AAC = ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000'];

/** [video]'s picture with [audio] under it instead, into [out]. */
export async function remux(video: string, audio: string, out: string): Promise<void> {
  await ffmpeg([
    ...['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy'],
    ...AAC,
    ...['-shortest', '-movflags', '+faststart', out],
  ]);
}

/** Joins [parts] in order into [out], with [audio] under it from [from] seconds when there is one. */
export async function join(parts: string[], list: string, out: string, audio: string | null, from = 0): Promise<void> {
  writeFileSync(list, parts.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
  const sound = audio ? ['-ss', String(from), '-i', audio, '-map', '0:v', '-map', '1:a', ...AAC, '-shortest'] : [];
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, ...sound, '-c:v', 'copy', '-movflags', '+faststart', out]);
}

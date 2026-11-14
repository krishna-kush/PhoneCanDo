// Mending a finished video without drawing it all again: only frames
// [first, last) are drawn fresh; the rest are decoded from the video as it
// is, the fresh ones set in by frame number, and the whole encoded once with
// its timestamps counted out again. (Copying pieces as they are can't do
// this: with B-frames a cut by time takes a frame or two of the next piece,
// and the joins slip.) The sound is copied over unchanged.

import { execFileSync } from 'node:child_process';
import { ffmpeg, x264, type Quality } from './encode.ts';

const probe = (video: string, entry: string, extra: string[] = []) =>
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', ...extra, '-show_entries', `stream=${entry}`, '-of', 'csv=p=0', video], {
    encoding: 'utf8',
  })
    .trim()
    .replace(/,$/, '');

/** [video]'s frames a second. */
export function fpsOf(video: string): number {
  const [n, d] = probe(video, 'r_frame_rate').split('/').map(Number);
  return n / (d || 1);
}

/** How many frames [video] has (its packets counted, nothing decoded). */
export const framesOf = (video: string): number => Number(probe(video, 'nb_read_packets', ['-count_packets']));

/**
 * [video], [total] frames at [fps], with its frames [first, last) replaced
 * by [fresh] (pieces drawn from those frames, in order), encoded at [q]
 * into [out]; its sound copied over unchanged.
 */
export async function splice(video: string, fps: number, first: number, last: number, total: number, fresh: readonly string[], q: Quality, out: string): Promise<void> {
  const graph = ['[0:v]split=2[pre][post]'];
  const parts: string[] = [];
  if (first > 0) {
    graph.push(`[pre]trim=end_frame=${first},setpts=PTS-STARTPTS[head]`);
    parts.push('[head]');
  } else graph.push('[pre]nullsink');
  fresh.forEach((_, i) => {
    graph.push(`[${i + 1}:v]setpts=PTS-STARTPTS[new${i}]`);
    parts.push(`[new${i}]`);
  });
  if (last < total) {
    graph.push(`[post]trim=start_frame=${last},setpts=PTS-STARTPTS[tail]`);
    parts.push('[tail]');
  } else graph.push('[post]nullsink');
  graph.push(`${parts.join('')}concat=n=${parts.length}:v=1:a=0,setpts=N/(${fps}*TB)[v]`);
  await ffmpeg([
    ...['-i', video, ...fresh.flatMap((f) => ['-i', f])],
    ...['-filter_complex', graph.join(';'), '-map', '[v]', '-map', '0:a?', '-fps_mode', 'passthrough'],
    ...x264(fps, q),
    ...['-c:a', 'copy', '-movflags', '+faststart', out],
  ]);
}

// The splice's promise, on a small made-up video with B-frames: as many
// frames out as in, the fresh ones exactly where they were asked for, on
// exact timestamps, the sound kept. Needs ffmpeg; skipped without it.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { OUT } from '../facts/repo.ts';
import { FINAL, ffmpeg, x264 } from './encode.ts';
import { framesOf, splice } from './splice.ts';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const FPS = 30;

/** Frame [n] of [video] shrunk to one pixel: its average red, green, blue. */
const colorAt = (video: string, n: number) =>
  [...execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `select=eq(n\\,${n}),scale=1:1`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])];

const isRed = ([r, g, b]: number[]) => r > 180 && g < 80 && b < 80;

test('a splice sets the fresh frames in by number and keeps every other frame and the sound', { skip: !hasFfmpeg }, async () => {
  const dir = join(OUT, '.work', `splice-test-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const video = join(dir, 'video.mp4');
    const fresh = join(dir, 'fresh.mp4');
    const out = join(dir, 'out.mp4');
    await ffmpeg([
      ...['-f', 'lavfi', '-i', `testsrc2=size=160x90:rate=${FPS}:duration=2`, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'],
      ...['-shortest', ...x264(FPS, FINAL), '-c:a', 'aac', video],
    ]);
    await ffmpeg(['-f', 'lavfi', '-i', `color=c=red:size=160x90:rate=${FPS}:duration=0.5`, ...x264(FPS, FINAL), fresh]);

    await splice(video, FPS, 20, 35, 60, [fresh], FINAL, out);

    assert.equal(framesOf(out), 60);
    assert.ok(!isRed(colorAt(out, 19)), 'frame 19 is the old one');
    assert.ok(isRed(colorAt(out, 20)), 'frame 20 is the first fresh one');
    assert.ok(isRed(colorAt(out, 34)), 'frame 34 is the last fresh one');
    assert.ok(!isRed(colorAt(out, 35)), 'frame 35 is the old one again');
    const pts = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', out], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map((row) => Number(row.split(',')[0]));
    pts.forEach((t, n) => assert.ok(Math.abs(t - n / FPS) < 1e-3, `frame ${n} at ${t}`));
    const streams = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', out], { encoding: 'utf8' });
    assert.match(streams, /audio/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// One worker's share of a render: its own Chrome on the page, a run of
// frames drawn and photographed one by one, each piped into its own ffmpeg.

import { once } from 'node:events';
import { openPage } from './chrome.ts';
import { frameSink, type Capture, type Quality } from './encode.ts';

export type Share = {
  url: string;
  width: number;
  height: number;
  scale: number;
  fps: number;
  /** Frames [from, to). */
  from: number;
  to: number;
  out: string;
  work: string;
  quality: Quality;
  capture: Capture;
  /** Called after each frame. */
  tick: () => void;
};

export async function renderShare(s: Share): Promise<void> {
  const page = await openPage(s.url, s.width, s.height, s.scale, s.work);
  const sink = frameSink(s.out, s.fps, s.quality, s.capture);
  let err = '';
  sink.stderr.on('data', (d: Buffer) => (err += d.toString()));
  const exited = once(sink, 'exit');
  try {
    for (let f = s.from; f < s.to; f++) {
      await page.run(`__frame(${f / s.fps})`);
      const shot = await page.shot(s.capture, 96);
      if (!sink.stdin.write(shot)) await once(sink.stdin, 'drain');
      s.tick();
    }
  } finally {
    sink.stdin.end();
    await page.close();
  }
  const [code] = await exited;
  if (code !== 0) throw new Error(`ffmpeg failed on ${s.out} (${code}): ${err.slice(-1500)}`);
}

/** Photographs the page at each of [seconds], as PNGs. */
export async function renderStills(url: string, width: number, height: number, seconds: readonly number[], work: string): Promise<Buffer[]> {
  const page = await openPage(url, width, height, 1, work);
  const shots: Buffer[] = [];
  try {
    for (const t of seconds) {
      await page.run(`__frame(${t})`);
      shots.push(await page.shot('png'));
    }
  } finally {
    await page.close();
  }
  return shots;
}

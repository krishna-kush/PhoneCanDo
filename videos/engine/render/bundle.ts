// The films bundled for a render: Remotion compiles films/index.tsx once
// and every composition is drawn from that. Everything a render scratches
// stays under out/, on disk: the bundle, and the temp files of the tools it
// runs (TMPDIR), never the system's temp folder. Node only.

import { bundle } from '@remotion/bundler';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { FILMS, OUT, PUBLIC } from '../paths.ts';

/**
 * This run's own scratch, made, set as TMPDIR and cleared when the run
 * ends, so two runs never clear each other's. Call before anything renders.
 */
export function scratch(): string {
  const dir = join(OUT, '.tmp', String(process.pid));
  mkdirSync(dir, { recursive: true });
  process.env.TMPDIR = dir;
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  // Stopped from the keyboard or by a signal, leave through exit so the scratch still goes.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => process.exit(130));
  return dir;
}

/** Bundles every film; the bundle's folder, to serve renders from. */
export async function bundleFilms(): Promise<string> {
  mkdirSync(PUBLIC, { recursive: true });
  const started = Date.now();
  const served = await bundle({
    entryPoint: join(FILMS, 'index.tsx'),
    publicDir: PUBLIC,
    outDir: join(OUT, '.bundle'),
  });
  console.log(`bundled in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  return served;
}

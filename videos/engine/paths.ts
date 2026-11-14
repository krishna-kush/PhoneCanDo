// Where things are on disk, from this file. Node only.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The videos package. */
export const VIDEOS = fileURLToPath(new URL('../', import.meta.url));

/** Every film's folder. */
export const FILMS = join(VIDEOS, 'films');

/** What the page loads that we generate (each film's sound): Remotion's public folder. */
export const PUBLIC = join(VIDEOS, 'public');

/** Everything a render writes: videos, stills, filmstrips. */
export const OUT = join(VIDEOS, 'out');

/** The films there are: every folder in films/ with a film.tsx. */
export const filmIds = (): string[] =>
  readdirSync(FILMS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(FILMS, d.name, 'film.tsx')))
    .map((d) => d.name)
    .sort();

/** A film's id as asked for on a command line, or an error naming the films there are. */
export function filmArg(id: string | undefined): string {
  const all = filmIds();
  if (id && all.includes(id)) return id;
  throw new Error(`${id ? `No film called ${id}` : 'Which film?'} There ${all.length === 1 ? 'is' : 'are'}: ${all.join(', ')}.`);
}

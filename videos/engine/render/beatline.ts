// A film's beat line, read from its folder for the commands: every film
// exports TEMPO and LINE from films/<id>/beats.ts. Node only.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BeatLine } from './moments.ts';
import { FILMS } from '../paths.ts';

export async function beatLineOf(film: string): Promise<BeatLine> {
  const file = join(FILMS, film, 'beats.ts');
  const mod = (await import(pathToFileURL(file).href)) as { TEMPO?: BeatLine['tempo']; LINE?: BeatLine['line'] };
  if (!mod.TEMPO || !mod.LINE) throw new Error(`${file} has to export TEMPO and LINE.`);
  return { tempo: mod.TEMPO, line: mod.LINE };
}

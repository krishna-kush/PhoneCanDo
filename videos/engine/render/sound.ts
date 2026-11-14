// A film's sound, there before its picture is shown: a film with a
// sound.ts gets its mix made (engine/sound/cli.ts) when public/ has none
// yet, so a preview or a render is never silent by accident. A mix that is
// there is left alone; `pnpm sound <film>` makes it again. Node only.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { mixFile } from './film.ts';
import { FILMS, PUBLIC, VIDEOS } from '../paths.ts';

export const hasSound = (film: string) => existsSync(join(FILMS, film, 'sound.ts'));

export function ensureSound(film: string): void {
  if (!hasSound(film) || existsSync(join(PUBLIC, mixFile(film)))) return;
  console.log(`${film}: no sound in public/ yet, making it`);
  const made = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', join(VIDEOS, 'engine/sound/cli.ts'), film], { stdio: 'inherit' });
  if (made.status !== 0) throw new Error(`${film}: its sound could not be made (pnpm sound ${film} says why).`);
}

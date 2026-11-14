// pnpm studio: Remotion's preview on every film, with each film's sound
// made first when public/ has none, and its temp files kept under out/.
// Whatever follows on the command line goes to `remotion studio` as it is.

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { scratch } from './bundle.ts';
import { filmIds, VIDEOS } from '../paths.ts';
import { ensureSound } from './sound.ts';

scratch();
for (const film of filmIds()) ensureSound(film);

const studio = spawn(join(VIDEOS, 'node_modules/.bin/remotion'), ['studio', ...process.argv.slice(2)], { cwd: VIDEOS, stdio: 'inherit', env: process.env });
studio.on('exit', (code) => process.exit(code ?? 0));

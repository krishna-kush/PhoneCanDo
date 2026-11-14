// Where things are on disk, from this file: the repo and the video package.

import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('../../../', import.meta.url));

export const VIDEO = fileURLToPath(new URL('../../', import.meta.url));

/** Everything a render writes: videos, stills, audio. */
export const OUT = fileURLToPath(new URL('../../out/', import.meta.url));

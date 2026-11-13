// Every part worn on the face, by its id. A new one is a file here and a line below.

import { blush } from './blush.ts';
import { eyepatch } from './eyepatch.ts';
import { glasses } from './glasses.ts';
import { monocle } from './monocle.ts';
import { mustache } from './mustache.ts';

export const FACES = {
  blush,
  eyepatch,
  glasses,
  monocle,
  mustache,
};

export type FaceId = keyof typeof FACES;

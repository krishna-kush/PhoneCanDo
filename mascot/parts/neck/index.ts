// Every part worn at the neck, by its id. A new one is a file here and a line below.

import { badge } from './badge.ts';
import { bowtie } from './bowtie.ts';
import { collar } from './collar.ts';
import { medal } from './medal.ts';
import { scarf } from './scarf.ts';
import { tie } from './tie.ts';

export const NECKS = {
  badge,
  bowtie,
  collar,
  medal,
  scarf,
  tie,
};

export type NeckId = keyof typeof NECKS;

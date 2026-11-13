// Every hat, by its id. A new hat is a file here and a line below.

import { antenna } from './antenna.ts';
import { bandana } from './bandana.ts';
import { beanie } from './beanie.ts';
import { beret } from './beret.ts';
import { bow } from './bow.ts';
import { bucket } from './bucket.ts';
import { bun } from './bun.ts';
import { bunnyEars } from './bunnyEars.ts';
import { cap } from './cap.ts';
import { capBack } from './capBack.ts';
import { catEars } from './catEars.ts';
import { chef } from './chef.ts';
import { cowboy } from './cowboy.ts';
import { crown } from './crown.ts';
import { halo } from './halo.ts';
import { hardhat } from './hardhat.ts';
import { headband } from './headband.ts';
import { headphones } from './headphones.ts';
import { headset } from './headset.ts';
import { horns } from './horns.ts';
import { mohawk } from './mohawk.ts';
import { mortarboard } from './mortarboard.ts';
import { party } from './party.ts';
import { propeller } from './propeller.ts';
import { santa } from './santa.ts';
import { shades } from './shades.ts';
import { sprout } from './sprout.ts';
import { tophat } from './tophat.ts';
import { tuft } from './tuft.ts';
import { viking } from './viking.ts';
import { wizard } from './wizard.ts';

export const HATS = {
  antenna,
  bandana,
  beanie,
  beret,
  bow,
  bucket,
  bun,
  bunnyEars,
  cap,
  capBack,
  catEars,
  chef,
  cowboy,
  crown,
  halo,
  hardhat,
  headband,
  headphones,
  headset,
  horns,
  mohawk,
  mortarboard,
  party,
  propeller,
  santa,
  shades,
  sprout,
  tophat,
  tuft,
  viking,
  wizard,
};

export type HatId = keyof typeof HATS;

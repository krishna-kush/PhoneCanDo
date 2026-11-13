// Who lies in the playground, and the trick each one has once it is awake:
// the phone's apps, and a few cousins of the A-series in their hats
// (data/wear.ts). You find a trick by throwing the one who has it. The
// numbers here are how each moves (physics.ts); what the tricks do is
// habits.ts's, collide.ts's and, for digging and thuds, physics.ts's.
// Nothing here draws.

import { wear, type Wear } from '../../../data/wear';
import type { AppKind } from '../story/characters/app';

export type CousinKind = 'headphones' | 'hardhat' | 'tophat' | 'cap';
export type ToyKind = AppKind | CousinKind;

export type Trick =
  /** Clock: rolls on along a deck, a wheel. */
  | 'roll'
  /** Music: bounces and bounces, a note each time. */
  | 'spring'
  /** Notes: drifts down like paper, side to side. */
  | 'flutter'
  /** Maps: in the air, finds its way toward the nearest sleeper. */
  | 'home'
  /** Settings: grinds on, carrying whoever it runs into along. */
  | 'grind'
  /** Messages: a hit sends a message on, to wake the next sleeper that way. */
  | 'ping'
  /** Flashlight: shines where you point, brightest in the dark. */
  | 'shine'
  /** Headphones: hops to a beat for a while. */
  | 'dance'
  /** Hard hat: thrown down hard, digs through the deck to the floor below. */
  | 'dig'
  /** Top hat: heavy; landing hard shakes everyone on the floor. */
  | 'thud'
  /** Cap: runs about for a while. */
  | 'run';

export type Traits = {
  trick: Trick;
  /** How hard a deck throws it back. */
  bounce: number;
  /** How quickly it stops along a deck. */
  friction: number;
  /** Times gravity. */
  fall: number;
  /** It falls no faster than this. */
  fastest: number;
  /** How much it weighs against another in a shove. */
  mass: number;
};

const PLAIN = { bounce: 0.32, friction: 7, fall: 1, fastest: 2600, mass: 1 };

export const TRAITS: Record<ToyKind, Traits> = {
  clock: { ...PLAIN, trick: 'roll', friction: 0.7 },
  music: { ...PLAIN, trick: 'spring', bounce: 0.8 },
  notes: { ...PLAIN, trick: 'flutter', bounce: 0.15, friction: 9, fall: 0.35, fastest: 340, mass: 0.6 },
  maps: { ...PLAIN, trick: 'home' },
  settings: { ...PLAIN, trick: 'grind', friction: 3, mass: 2 },
  messages: { ...PLAIN, trick: 'ping' },
  flashlight: { ...PLAIN, trick: 'shine' },
  headphones: { ...PLAIN, trick: 'dance', bounce: 0.4 },
  hardhat: { ...PLAIN, trick: 'dig', bounce: 0.2, mass: 1.5 },
  tophat: { ...PLAIN, trick: 'thud', bounce: 0.05, fall: 1.25, mass: 3 },
  cap: { ...PLAIN, trick: 'run' },
};

/** What each cousin wears: its hat is its trick, so you learn them by sight. */
export const COUSIN_WEAR: Record<CousinKind, Wear> = {
  headphones: wear({ hat: 'headphones' }),
  hardhat: wear({ hat: 'hardhat' }),
  tophat: wear({ hat: 'tophat', neck: 'bowtie' }),
  cap: wear({ hat: 'cap' }),
};

export const isCousin = (kind: ToyKind): kind is CousinKind => kind in COUSIN_WEAR;

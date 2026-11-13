// What a unit of the A-series wears, so cousins tell apart at a glance: one
// thing on its head, one at its neck, and glasses or not. Each changes the
// unit's outline, so it still reads at a few px. The page's card bots
// (components/sections/models/Bot.astro) and the backdrop's units
// (lib/backdrop/paint/unit.ts) draw the same set.

export type Hat =
  | 'none'
  | 'antenna'
  | 'cap'
  /** A cap turned round: its visor points behind. */
  | 'capBack'
  | 'beanie'
  | 'tophat'
  | 'headphones'
  /** A tuft of hair. */
  | 'tuft'
  /** The Diggers' hard hats; the backdrop only. */
  | 'hardhat'
  /** A headset with a mic; the backdrop only. */
  | 'headset';

export type Neck = 'none' | 'tie' | 'bowtie';

export type Wear = { hat: Hat; neck: Neck; glasses: boolean };

export const BARE: Wear = { hat: 'none', neck: 'none', glasses: false };

/** Wear from its parts; what is left out is bare. */
export const wear = (w: Partial<Wear>): Wear => ({ ...BARE, ...w });

/**
 * The crew's wear, by the part each plays in the story (data/backdrop.ts,
 * crewParts): the one who writes the code, the one who runs the tests, the
 * one who checks it twice, the one who keeps watch. The page's lead kinds
 * wear these, in the order the page leads with them.
 */
export const CREW_WEAR: Wear[] = [
  wear({ neck: 'tie', glasses: true }),
  wear({ hat: 'capBack' }),
  wear({ neck: 'bowtie' }),
  wear({ hat: 'beanie' }),
];

/** Everyone else's, in turn: none of them a crew member's. */
export const OTHER_WEAR: Wear[] = [
  wear({ hat: 'tophat' }),
  wear({ hat: 'headphones' }),
  wear({ hat: 'tuft', neck: 'tie' }),
  wear({ hat: 'antenna' }),
  wear({ hat: 'cap', glasses: true }),
  wear({ neck: 'bowtie', glasses: true }),
  wear({ hat: 'tuft' }),
  wear({ hat: 'cap' }),
  wear({ hat: 'headphones', neck: 'tie' }),
  wear({ hat: 'antenna', neck: 'bowtie' }),
  wear({ glasses: true }),
  wear({ hat: 'tophat', neck: 'bowtie' }),
];

/** How far over the block's top a hat reaches, as a share of the block's short side. */
export const HAT_RISE: Record<Hat, number> = {
  none: 0,
  antenna: 0.45,
  cap: 0.2,
  capBack: 0.2,
  beanie: 0.42,
  tophat: 0.56,
  headphones: 0.16,
  tuft: 0.26,
  hardhat: 0.3,
  headset: 0.16,
};

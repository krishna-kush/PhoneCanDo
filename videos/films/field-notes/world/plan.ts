// The phone's inside, as a cutaway: where every floor, wall and fitting
// is, in u. x runs from the phone's middle, y down from under its top
// edge. Four floors, bottom to top: the bunks, the workshop, the landing
// with its gate, and the glass with your apps. A shaft with a ladder runs
// up the left wall through all of them. Pure numbers; the picture draws
// from these and the cast stands on them.

export type FloorId = 'glass' | 'landing' | 'workshop' | 'bunks';

/** The rooms' left and right walls. */
export const WALL = { left: -75, right: 75 };

/** The phone's body around them. */
export const PHONE = { x: -80, y: -10, w: 160, h: 262, r: 13 };

/** How thick a floor's slab is: feet stand this far above the room's bottom edge. */
const SLAB = 4;

export const FLOORS: Record<FloorId, { top: number; h: number; fig: string }> = {
  glass: { top: 6, h: 60, fig: 'FIG. 05 — The glass' },
  landing: { top: 70, h: 42, fig: 'FIG. 04 — The gate' },
  workshop: { top: 116, h: 60, fig: 'FIG. 03 — The workshop' },
  bunks: { top: 180, h: 60, fig: 'FIG. 02 — The bunks' },
};

/** Where feet stand on a floor. */
export const groundOf = (floor: FloorId) => FLOORS[floor].top + FLOORS[floor].h - SLAB;

/** A floor's middle, for the camera. */
export const middleOf = (floor: FloorId) => FLOORS[floor].top + FLOORS[floor].h / 2;

/** A unit's short side. */
export const UNIT = 11;

/** The shaft up the left wall: the ladder's middle. */
export const SHAFT = -70;

/** The phone's roof, where the night watch stands. */
export const ROOF = PHONE.y;

/**
 * The bunks: three double beds either side of an aisle. A-01's own bed is
 * alone in the aisle, under the lamp cord, and the night watch has no bed:
 * it sleeps standing at its post by the far wall. Where each one's feet are.
 */
const DOUBLES = [-56, -38, -20, 20, 38, 56];
const UPPER = 27;
export const BUNKS = [
  ...DOUBLES.map((x) => ({ x, y: groundOf('bunks'), upper: false })),
  ...DOUBLES.map((x) => ({ x, y: groundOf('bunks') - UPPER, upper: true })),
];
export const BUNK = { w: 15, upper: UPPER, doubles: DOUBLES };
export const OWN_BED = { x: 0, y: groundOf('bunks'), upper: false };
export const POST = { x: 69, y: groundOf('bunks'), upper: false };

/** The lamp cord over A-01's bed: where its knob hangs, and how high a jump reaches it (in short sides). */
export const CORD = { x: OWN_BED.x, y: FLOORS.bunks.top + 24, jump: 2 };

/** Every floor's lamps: where they hang along it. */
export const LAMPS = [-56, -19, 19, 56];

export const WORKSHOP = {
  /** The terminal on the wall. */
  terminal: { x: -64, y: FLOORS.workshop.top + 9, w: 58, h: 38 },
  /** The breaker that wakes it. */
  breaker: 2,
  /** The benches: where the others work. */
  bench: [22, 39, 56],
};

export const LANDING = {
  /** The wall the gate is set in, and the gate's middle and radius. */
  wall: 44,
  gate: { x: 44, y: groundOf('landing') - 16, r: 15 },
  /** Where the first of the line stops, and how far apart the rest stand behind it. */
  stop: 22,
  spacing: 11.5,
};

export const GLASS = {
  /** The app rooms: each one's middle, and their size. */
  windows: [-52, -18, 16, 50],
  window: { w: 30, h: 42 },
  /** Where the needle drops, between two of them. */
  deck: -1,
  /** Where a hat gets left behind. */
  hat: 33,
};

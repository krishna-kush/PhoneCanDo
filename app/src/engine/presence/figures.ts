// An agent's mascot laid out in every pose the overlay draws it in on the
// phone's screen (contract: the mascot's figures JSON), from the shared
// spec (mascot/), so the glass and the app draw the same unit. Native
// animates the rest itself: the gaze (the pupils inside `eye.open`),
// squash and stretch about the feet, and blinks (shrinking `eye.lid`).
// Side on it faces right; native mirrors it for the left. Pure (zero RN
// imports): scripts/vectors/test_presence.js checks it.
import { stretchOf, type Body } from '../../../../mascot/body.ts';
import { figure, type Facing } from '../../../../mascot/layout/figure.ts';
import type { Eyes } from '../../../../mascot/layout/eyes.ts';
import type { Figure } from '../../../../mascot/layout/types.ts';
import type { Look } from '../../../../mascot/look.ts';

/** The short side every pose is laid out at; native scales it to its own size. */
export const FIGURE_SIZE = 100;

/** The shape's version: native ignores a figures JSON it does not know. */
export const FIGURES_V = 1;

export type MascotFigures = {
  v: typeof FIGURES_V;
  /** The look's stretch, in short sides (mascot/body.ts). */
  shape: { w: number; h: number };
  poses: {
    front: Record<FrontEyes, Figure>;
    side: Record<SideEyes, Figure>;
    back: Figure;
  };
};

const FRONT = ['dot', 'wide', 'sleepy', 'shut', 'happy'] as const satisfies readonly Eyes[];
const SIDE = ['dot', 'shut'] as const satisfies readonly Eyes[];
type FrontEyes = (typeof FRONT)[number];
type SideEyes = (typeof SIDE)[number];

function pose(look: Look, body: Body, facing: Facing, eyes: Eyes): Figure {
  return figure(look, { size: FIGURE_SIZE, body, facing, toward: 1, eyes });
}

const byEyes = <K extends Eyes>(list: readonly K[], draw: (e: K) => Figure) =>
  Object.fromEntries(list.map((e) => [e, draw(e)])) as Record<K, Figure>;

/** Every pose of [look], with no gaze and no squash (native adds both). */
export function mascotFigures(look: Look, body: Body): MascotFigures {
  return {
    v: FIGURES_V,
    shape: stretchOf(look.shape, body),
    poses: {
      front: byEyes(FRONT, (e) => pose(look, body, 'front', e)),
      side: byEyes(SIDE, (e) => pose(look, body, 'side', e)),
      back: pose(look, body, 'back', 'dot'),
    },
  };
}

// Places to a hundredth of the size: finer than any screen pixel at the
// overlay's size, and a far shorter string to hand over.
const rounded = (_: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

/** The figures as the JSON native keeps (MascotFigures.set). */
export function mascotFiguresJson(look: Look, body: Body): string {
  return JSON.stringify(mascotFigures(look, body), rounded);
}

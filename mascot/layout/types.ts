// What a laid-out unit is made of, ready for a canvas, SVG or React Native
// to draw: boxes and marks in plain numbers, with the inks still named.

export type Box = { x: number; y: number; w: number; h: number };

/** The inks a laid-out mark is painted with: a part's `front` and `back` are resolved to the unit's red or amber. */
export type Color = 'wear' | 'red' | 'amber' | 'eye' | 'dark';

type Painted = { fill?: Color; stroke?: Color; /** Stroke width, the same units as the places. */ width: number; alpha: number };

export type Drawn =
  | ({ kind: 'rect'; x: number; y: number; w: number; h: number } & Painted)
  | ({ kind: 'poly'; points: readonly (readonly [number, number])[] } & Painted)
  | ({ kind: 'arc'; x: number; y: number; rx: number; ry: number; from: number; to: number } & Painted)
  | ({ kind: 'line'; points: readonly [readonly [number, number], readonly [number, number]] } & Painted);

export type Eye = {
  /** The open eye. */
  open: Box;
  /** The eye as drawn, its lid as far down as the expression has it. */
  lid: Box;
  /** Its pupil, when the eye is open enough to show one. */
  pupil: Box | null;
};

export type Figure = {
  /** The block nearer us and the one behind, each with its ink. */
  front: Box & { ink: 'red' | 'amber' };
  back: Box & { ink: 'red' | 'amber' };
  /** Two face on, one side on, none from behind. */
  eyes: readonly Eye[];
  /** What it wears (and from behind, its vent), in drawing order, over the blocks and eyes. */
  marks: readonly Drawn[];
  /** Everything drawn. */
  bounds: Box;
};

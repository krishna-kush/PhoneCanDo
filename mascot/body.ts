// The A-series body: the brand mark's two blocks, a red one on a hard amber
// one offset down and right (or swapped), in one of five shapes. The
// shadow's share and the long stretch come from theme/logo.json, the spec
// the logo loader runs on, through bodyOf(); the short stretch is ours, for
// a face that sits in a row.

/** Square, a third wider or taller, or as wide or tall as the loader stretches. */
export type Shape = 'square' | 'wide' | 'wider' | 'tall' | 'taller';

export const SHAPES: readonly Shape[] = ['square', 'wide', 'wider', 'tall', 'taller'];

/** The shadow's offset as a share of the short side, and how far each stretch reaches. */
export type Body = { shadow: number; short: number; long: number };

/** The short stretch. */
export const SHORT = 1.3;

type LogoSpec = { shadow: { ratio: number }; loader: { poses: readonly { w: number; h: number }[] } };

/** The body from theme/logo.json: its shadow, and the loader's longest pose as the long stretch. */
export function bodyOf(logo: LogoSpec): Body {
  const long = Math.max(...logo.loader.poses.map((p) => Math.max(p.w, p.h)));
  return { shadow: logo.shadow.ratio, short: SHORT, long };
}

/** A shape's width and height, in short sides. */
export function stretchOf(shape: Shape, body: Body): { w: number; h: number } {
  switch (shape) {
    case 'wide':
      return { w: body.short, h: 1 };
    case 'wider':
      return { w: body.long, h: 1 };
    case 'tall':
      return { w: 1, h: body.short };
    case 'taller':
      return { w: 1, h: body.long };
    case 'square':
      return { w: 1, h: 1 };
  }
}

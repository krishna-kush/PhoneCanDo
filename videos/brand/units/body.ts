// The A-series body and looks, from the shared spec (mascot/) and the logo
// (theme/logo.json): what every unit in a film is drawn from. Pure.

import logo from '../../../theme/logo.json' with { type: 'json' };
import { bodyOf, type Shape } from '../../../mascot/body.ts';
import type { DesignId } from '../../../mascot/designs.ts';
import type { Eyes } from '../../../mascot/layout/eyes.ts';
import type { Facing } from '../../../mascot/layout/figure.ts';
import type { Look } from '../../../mascot/look.ts';

export const BODY = bodyOf(logo);

/** A look from a design id: square and red in front unless told. */
export const lookOf = (design: DesignId, shape: Shape = 'square', swap = false): Look => ({ design, shape, swap });

export type { DesignId, Eyes, Facing, Look, Shape };

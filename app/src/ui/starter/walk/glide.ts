import { Easing } from 'react-native-reanimated';

/**
 * How the guide (its pointer and its bubble, in step) moves from one spot
 * to the next: eased out with one slight sway as it lands, never bouncing
 * up and down.
 */
export const GLIDE = { duration: 320, easing: Easing.out(Easing.back(0.6)) };

/** The same glide across (the pointer's left and width): no sway at all, so it never rocks side to side. */
export const GLIDE_ACROSS = { duration: 320, easing: Easing.out(Easing.cubic) };

/** How the pointer snaps onto a spot as it shows: one small overshoot. */
export const SNAP = { duration: 260, easing: Easing.out(Easing.back(1)) };

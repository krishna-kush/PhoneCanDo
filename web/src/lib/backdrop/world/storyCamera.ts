// The story page's camera (boot/story.ts). A phone's view is short: ridden
// the way the margins ride it (building.ts cameraY), a floor's deck stays
// under the view's foot for the first part of every chapter, where Little
// lands and its story starts. Here the deck Little is on stays low in the
// view instead. Over a chapter's stretch of the scroll (timeline.ts STAGE)
// the eye only drifts down toward the deck, from FAR over it to NEAR; past
// that it goes on down to the next floor. Wherever the scroll has got to,
// the eye stays between LOW and HIGH over the deck Little is on, and it
// follows Little down the hatch, so a deck never goes flat with Little
// still on it and Little never lands out of sight. Pure.

import { mix } from '../species/motion';
import { STAGE } from '../story/a07/timeline';
import { PITCH, floorY } from './building';

/** How far over the deck the eye is at a chapter's start and at its end, world units. */
const FAR = 200;
const NEAR = 110;
/** How close over the deck Little stands on the eye comes at most, and how far over it goes at most. */
const LOW = 50;
const HIGH = 260;
/** Where the deck sits down the view at a chapter's start, of the view's height. */
const FOOT = 0.84;

/** The eye's height for the scroll at floor number [floor], with Little at floor number [little] (timeline.ts depth). */
export function storyCameraY(floor: number, little: number): number {
  const i = Math.floor(floor);
  const q = floor - i;
  const over = q <= STAGE ? mix(FAR, NEAR, q / STAGE) : mix(NEAR, FAR - PITCH, (q - STAGE) / (1 - STAGE));
  const deck = floorY(little);
  return Math.min(deck - LOW, Math.max(deck - HIGH, floorY(i) - over));
}

/** Where the eye's level is down a view [h] px tall: so a deck FAR under it sits at FOOT. */
export const storyHorizon = (h: number) => h * FOOT - FAR;

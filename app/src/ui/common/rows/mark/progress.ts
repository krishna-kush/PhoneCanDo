import { useEffect } from 'react';
import {
  Easing,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../useReduceMotion';

// What every on/off look in this folder shares (SquareMark draws the one
// mark/looks.ts picks): its props, its curves and its 0-to-1 motion.

/** What every look takes, so SquareMark can draw any of them. */
export type MarkProps = {
  on: boolean;
  /** On and off at once, with no motion (a switch whose row moves enough already). */
  instant?: boolean;
};

// In: quick off the mark, settling softly (Material's emphasized
// decelerate); out: shorter, easing away. Timing curves only, never a
// spring, so nothing overshoots or wobbles.
export const IN_EASE = Easing.bezier(0.05, 0.7, 0.1, 1);
export const OUT_EASE = Easing.bezier(0.3, 0, 0.8, 0.15);
/** Both ways at one pace (a slide or a sweep that should not slam into its end). */
export const EVEN_EASE = Easing.bezier(0.4, 0, 0.2, 1);

type Ease = EasingFunction | EasingFunctionFactory;

/** Kept at module scope by each look: a new ease each render would restart the motion. */
type Pace = { inMs: number; outMs?: number; inEase?: Ease; outEase?: Ease };

/** A mark's 0 (off) to 1 (on), timed in and out at `pace`; at once when `instant` or with Reduce motion. */
export function useMarkProgress(on: boolean, instant: boolean, pace: Pace): SharedValue<number> {
  const reduce = useReduceMotion();
  const p = useSharedValue(on ? 1 : 0);
  const { inMs, outMs = 160, inEase = IN_EASE, outEase = OUT_EASE } = pace;
  useEffect(() => {
    const to = on ? 1 : 0;
    p.value = reduce || instant ? to : withTiming(to, on ? { duration: inMs, easing: inEase } : { duration: outMs, easing: outEase });
  }, [on, reduce, instant, inMs, outMs, inEase, outEase, p]);
  return p;
}

/** How far `v` is through `from`..`to`, held to 0..1: one stage of a mark's motion. */
export function stage(v: number, from: number, to: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (v - from) / (to - from)));
}

// What stands on some of the playground's floors: one thing a floor, the
// part of the page beside it made into something to throw an app at. By the
// apps, the dock: the apps asleep in its squares, and any you drop near it
// snaps into a free one. By the models, the Spark: an app that passes under
// it catches a spark of its own and wakes (a mind on the phone). By Linux, a
// sandpit under the chute above, so whoever comes down lands in it, digs,
// and climbs out in a hard hat (a whole machine to build in). By the crew, a
// seesaw under the chute above: drop one hard on its high end and whoever
// stands on the other flies up through the chute to the floor above (they
// take turns). By the key, a padlock on the chute: the apps following you
// wait there until you click it open (it goes on only with you). Nothing
// here draws.

import { SIZE, chuteShare } from '../toys';

export type Fixture =
  | {
      kind: 'spark' | 'pit' | 'lock';
      /** Where it stands, as a share of the way across the margin (the lock's is its chute's). */
      at: number;
    }
  | {
      kind: 'seesaw';
      /** Its launching end, under the chute above, as a share of the way across. */
      at: number;
      /** Which end is down: -1 the launching end, 1 the other; and where the plank is on its way there. */
      tilt: -1 | 1;
      lean: number;
    }
  | {
      kind: 'dock';
      /** The stretch it lies along, as shares of the way across, clear of the floor's chute. */
      at: number;
      to: number;
      /** When every square last filled up, seconds (0 while one is empty). */
      fullAt: number;
    };

export type FixtureKind = Fixture['kind'];

/** Which floor gets which, by the part of the page beside it. */
const ON: Record<string, FixtureKind> = { demos: 'dock', models: 'spark', linux: 'pit', crew: 'seesaw', gate: 'lock' };

/** The pit: across, how far back it runs, and how deep an app sinks into it. */
export const PIT = { w: 40, d: 44, deep: 16 };
/** How long an app digs before it climbs out, seconds. */
export const DIG = 1.1;
/** How near the Spark an app's middle must pass to catch a spark. */
export const SPARK_REACH = SIZE / 2 + 6;
/** How long catching a spark shows, seconds. */
export const LIT = 1.4;
/** How long the lock stays open after a click, seconds. */
export const OPEN = 4;

/** The fixture on each floor of a building whose parts are [keys], or null. */
export function fixturesFor(keys: string[]): (Fixture | null)[] {
  return keys.map((key, i): Fixture | null => {
    switch (ON[key]) {
      case 'spark':
        return { kind: 'spark', at: 0.45 };
      case 'pit':
        return { kind: 'pit', at: chuteShare(i - 1) };
      case 'lock':
        return { kind: 'lock', at: chuteShare(i) };
      case 'seesaw':
        // Loaded: its launching end down, the other up, waiting for a drop.
        return { kind: 'seesaw', at: chuteShare(i - 1), tilt: -1, lean: -1 };
      case 'dock':
        return chuteShare(i) < 0.5 ? { kind: 'dock', at: 0.36, to: 1, fullAt: 0 } : { kind: 'dock', at: 0, to: 0.64, fullAt: 0 };
      default:
        return null;
    }
  });
}

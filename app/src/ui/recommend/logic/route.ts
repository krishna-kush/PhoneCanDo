// How far the links got, for the Refer page's route: the furthest stop the
// funnel reached, each link's own, what A-01 makes of it and the line and
// stamp that say so. Pure (zero RN imports).
import type { LinkStats } from '../../../engine/share/wire.ts';
import type { Funnel } from './funnel.ts';

/** A link's own stops, after Sent. */
const LINK_STOPS = ['opened', 'downloaded', 'installed', 'using'] as const satisfies readonly (keyof Funnel & keyof LinkStats)[];

/** The funnel's stops in order. */
const STOPS = ['sent', ...LINK_STOPS] as const;

/** The furthest stop with anything on it (0 Sent … 4 Using it), or -1 when nothing went out. */
export function reach(f: Funnel): number {
  for (let i = STOPS.length - 1; i >= 0; i--) if (f[STOPS[i]] > 0) return i;
  return -1;
}

/** How many of a link's own stops (Opened … Using it) it reached: 0 to 4. */
export function linkReach(stats: LinkStats | undefined): number {
  if (!stats) return 0;
  for (let i = LINK_STOPS.length - 1; i >= 0; i--) if (stats[LINK_STOPS[i]] > 0) return i + 1;
  return 0;
}

/** A-01's face for the totals: asleep before a share, watching once one is out, looking about once opened, happy once a friend is in. */
export type RouteMood = 'asleep' | 'awake' | 'busy' | 'happy';

export function routeMood(f: Funnel): RouteMood {
  const r = reach(f);
  if (r < 0) return 'asleep';
  if (r === 0) return 'awake';
  if (r < 3) return 'busy';
  return 'happy';
}

/** The line at the top of the route: what the links did, as a friend would say it. */
export function routeVerdict(f: Funnel): string {
  switch (reach(f)) {
    case -1:
      return 'No links out yet. Share one and this box starts counting.';
    case 0:
      return f.sent === 1 ? "Your link is out there. Nobody's tapped it yet." : "Your links are out there. Nobody's tapped one yet.";
    case 1:
      return 'Someone peeked! No download yet.';
    case 2:
      return 'A download! Now we wait for the install.';
    case 3:
      return f.installed === 1 ? 'You brought a friend aboard.' : `You brought ${f.installed} friends aboard.`;
    default:
      return 'They came back another day. That is a real crew mate.';
  }
}

/** The stamp on a route that brought someone in ("+1 crew"); null before an install. */
export function crewStamp(f: Funnel): string | null {
  return f.installed > 0 ? `+${f.installed} crew` : null;
}

// How the Apps page lays its answered apps out: by kind, for its two
// boxes. Pure (zero RN imports).
import type { AppAccessApp } from '../../../engine/appAccess';

/** The answered apps by kind, each in the list's own order (by label). */
export function splitApps(apps: readonly AppAccessApp[]): { always: AppAccessApp[]; blocked: AppAccessApp[] } {
  return { always: apps.filter((a) => a.state === 'always'), blocked: apps.filter((a) => a.state === 'blocked') };
}

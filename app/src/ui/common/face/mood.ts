// A-01's face for an agent: its engine state as a mood, and the agent's
// serial and body shape. Pure (zero RN imports). The face is never the only
// signal: rows say the state in words too.
import type { EngineState } from '../../../engine/agents/records';

/**
 * awake: running · busy: starting, stopping or installing · asleep: stopped ·
 * oops: failed or died · sweaty: A-01 itself while the phone is nearly out
 * of memory (the RAM warning; no engine state maps to it).
 */
export type Mood = 'awake' | 'busy' | 'asleep' | 'oops' | 'sweaty';

/** The loader's poses (theme/logo.json), toned down so a row stays a row. */
export type Pose = 'square' | 'wide' | 'tall';

export function moodOf(state: EngineState | null | undefined, installing = false): Mood {
  if (installing) return 'busy';
  switch (state) {
    case 'ready':
      return 'awake';
    case 'starting':
    case 'stopping':
      return 'busy';
    case 'died':
    case 'failed':
      return 'oops';
    default:
      return 'asleep';
  }
}

type Dated = { id: string; createdAt: number };

/** "A-01" for the oldest agent, "A-02" for the next…; like the site's A-01 and A-02. */
export function agentSerial(agents: readonly Dated[], id: string): string {
  const order = [...agents].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  const n = order.findIndex((a) => a.id === id) + 1;
  return `A-${String(Math.max(n, 1)).padStart(2, '0')}`;
}

const POSES: Pose[] = ['square', 'wide', 'tall'];

/** Each agent keeps one shape, by its serial: the palette has two inks, so shape tells them apart. */
export function poseOf(serial: string): Pose {
  const n = Number(serial.slice(2)) || 1;
  return POSES[(n - 1) % POSES.length];
}

/** Width and height of the body for a pose, in face sizes. */
export function poseScale(pose: Pose): { w: number; h: number } {
  switch (pose) {
    case 'wide':
      return { w: 1.3, h: 1 };
    case 'tall':
      return { w: 1, h: 1.3 };
    case 'square':
      return { w: 1, h: 1 };
  }
}

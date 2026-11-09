// What a TUI home shows, from how its engine start went, whether the
// terminal it showed ended, and the engine's state. Pure, no RN imports.
import type { EngineState } from '../../../engine/agents/records';

/** This view's start of the engine: in flight, done, or refused. */
export type TuiStart = { kind: 'pending' } | { kind: 'ok' } | { kind: 'failed'; error: string };

export type TuiPhase =
  | { name: 'starting' }
  /** The engine is ready: the terminal attaches. */
  | { name: 'attached' }
  /**
   * The program stopped or died (its error, when it died). [screen]: it
   * ended while this view showed it, so its last screen (often why it
   * stopped) is still there to read.
   */
  | { name: 'stopped'; error: string | null; screen: boolean }
  /** The engine could not start. */
  | { name: 'failed'; error: string };

export function tuiPhase(p: {
  start: TuiStart;
  /** The terminal this view showed reported the program gone. */
  ended: boolean;
  /**
   * This view showed the program in this run: a stop the runner reports
   * before the terminal sees its output end still leaves the screen on view.
   */
  shown: boolean;
  state: EngineState | undefined;
  stateError: string | null;
}): TuiPhase {
  const died = p.state === 'died' || p.state === 'failed' ? p.stateError : null;
  if (p.ended) return { name: 'stopped', error: died, screen: true };
  // A ready engine attaches at once, even while the start call that only
  // marks it used is still in flight.
  if (p.state === 'ready') return { name: 'attached' };
  if (p.start.kind === 'failed') return { name: 'failed', error: p.start.error };
  if (p.start.kind === 'pending' || p.state === 'starting' || p.state === undefined) return { name: 'starting' };
  return { name: 'stopped', error: died, screen: p.shown };
}

// What a TUI home shows, from how its engine start went, whether the
// terminal it showed ended, and the engine's state and mode. Pure, no RN
// imports.
import type { EngineMode, EngineState } from '../../../engine/agents/records';

/**
 * This view's start of the engine: in flight, done, refused, or refused
 * because the agent's ACP turn still runs (acp_busy: the background view
 * shows that turn, and the terminal is asked for again when it ends).
 */
export type TuiStart = { kind: 'pending' } | { kind: 'ok' } | { kind: 'busy' } | { kind: 'failed'; error: string };

export type TuiPhase =
  | { name: 'starting' }
  /** The engine runs in ACP mode (a task that came while nobody watched): its run shows, not a terminal. */
  | { name: 'background' }
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

/** ACP mode states in which the background view shows (a switch back passes through stopping). */
const LIVE: readonly (EngineState | undefined)[] = ['starting', 'ready', 'stopping'];

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
  /** Undefined reads as terminal. */
  mode?: EngineMode;
}): TuiPhase {
  // An engine in ACP mode has no terminal: a screen that ended for the
  // switch to it is not the story any more.
  if (p.mode === 'acp' && LIVE.includes(p.state)) return { name: 'background' };
  const died = p.state === 'died' || p.state === 'failed' ? p.stateError : null;
  if (p.ended) return { name: 'stopped', error: died, screen: true };
  // A ready engine attaches at once, even while the start call that only
  // marks it used is still in flight.
  if (p.state === 'ready') return { name: 'attached' };
  if (p.start.kind === 'failed') return { name: 'failed', error: p.start.error };
  if (p.start.kind === 'pending' || p.state === 'starting' || p.state === undefined) return { name: 'starting' };
  return { name: 'stopped', error: died, screen: p.shown };
}

/**
 * How long a finished background run stays on view before Home asks for
 * the terminal: a start in ACP mode is ready a moment before it sends its
 * task, and that moment must not read as finished.
 */
export const SETTLE_MS = 2000;

/**
 * Whether Home should ask for its terminal back (after SETTLE_MS): the
 * engine is ready in ACP mode with no turn running, Home and the app are in
 * front, no start of ours is in flight and none was asked for since the
 * turn ended.
 */
export function wantsTerminal(p: {
  phase: TuiPhase;
  state: EngineState | undefined;
  busy: boolean;
  start: TuiStart;
  inFront: boolean;
  appActive: boolean;
  asked: boolean;
}): boolean {
  return (
    p.phase.name === 'background' &&
    p.state === 'ready' &&
    !p.busy &&
    p.start.kind !== 'pending' &&
    p.inFront &&
    p.appActive &&
    !p.asked
  );
}

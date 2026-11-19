// Engine seam for presence (types.ts): who has the phone's controls, each
// agent's status line, and the mascot's figures the overlay draws, through
// the phonecando-runner module (engine/runner.ts). Native sends
// phonecandoPresence, with the whole frame, on every change. A native
// build from before presence reads as nobody and no lines, and its
// buttons and figures do nothing.
import type { AgentId } from '../agents/records';
import { isRunnerAvailable, nativeRunner, onRunnerEvent, type RunnerModule } from '../runner';
import { asPresence, NO_PRESENCE } from './parse';
import type { PresenceFrame, UserAct } from './types';

export const PRESENCE_EVENT = 'phonecandoPresence';

function runner(): Partial<RunnerModule> {
  if (!isRunnerAvailable()) return {};
  try {
    return nativeRunner();
  } catch {
    return {};
  }
}

/** The frame now; nobody and no lines where the module or the method is absent. */
export function presenceSnapshot(): PresenceFrame {
  try {
    return asPresence(runner().presenceSnapshot?.());
  } catch {
    return NO_PRESENCE;
  }
}

/** A hand-over button's act; false when the runner refused it (nothing to end) or cannot take it. */
export function presenceAct(act: UserAct): boolean {
  try {
    return runner().presenceAct?.(act) === true;
  } catch {
    return false;
  }
}

/** Hands the overlay an agent's mascot drawn in its poses (figures.ts); a no-op on a build without the overlay's store. */
export function setMascotFigures(agentId: AgentId, json: string): void {
  try {
    runner().setMascotFigures?.(agentId, json);
  } catch {
    // the overlay keeps the figures it had, or draws none
  }
}

/** The app's theme setting, for the mascot on the glass (system: the phone's); older builds ignore it. */
export function setGlassScheme(scheme: 'system' | 'light' | 'dark'): void {
  try {
    runner().setGlassScheme?.(scheme);
  } catch {
    // the glass keeps the phone's own light or dark
  }
}

/** Every change to the frame, as it is now; a no-op subscription where the module is absent. */
export function onPresence(listener: (frame: PresenceFrame) => void): { remove(): void } {
  return onRunnerEvent<unknown>(PRESENCE_EVENT, (e) => listener(asPresence(e)));
}

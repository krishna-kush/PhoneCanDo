// Engine seam for capability checks (types.ts): what we have seen each of
// an agent's capabilities do, each kind's messaging level now, and Check
// now, through the phonecando-runner module (engine/runner.ts). Native
// sends phonecandoChecks, with the agent, on each change to a check or to
// a Check now run (its state, part or step, the reading's percent). A
// native build from before checks reads as nothing: no checks, no levels
// (each kind then reads its declared level), and Check now can't start.
import type { AgentId } from '../agents/records';
import { isRunnerAvailable, nativeRunner, onRunnerEvent, type RunnerModule } from '../runner';
import { asAgentChecks, asCheckNowResult, asChecksChange, asKindLevels } from './parse';
import type { AgentChecks, ChecksChange, KindLevels } from './types';

function runner(): Partial<RunnerModule> {
  if (!isRunnerAvailable()) return {};
  try {
    return nativeRunner();
  } catch {
    return {};
  }
}

/** The agent's checks; null for an unknown agent or a build without checks. */
export function agentChecks(agentId: AgentId): AgentChecks | null {
  try {
    return asAgentChecks(runner().agentChecks?.(agentId));
  } catch {
    return null;
  }
}

/** Each kind's messaging level now; empty where the module or the method is absent. */
export function kindLevels(): KindLevels {
  try {
    return asKindLevels(runner().kindLevels?.());
  } catch {
    return {};
  }
}

/** Starts Check now for the agent, every capability when full, else only those not checked yet: null when it started, else why not. */
export function checkNow(agentId: AgentId, full: boolean): string | null {
  const r = runner();
  if (typeof r.checkNow !== 'function') return "This version of the app can't run a check.";
  try {
    return asCheckNowResult(r.checkNow(agentId, full));
  } catch (e) {
    return e instanceof Error && e.message ? e.message : "Couldn't start the check.";
  }
}

/** Stops the agent's running check (its engine stops too, to free memory); false when none runs. */
export function checkCancel(agentId: AgentId): boolean {
  try {
    return runner().checkCancel?.(agentId) === true;
  } catch {
    return false;
  }
}

/** Every change to a check or a Check now run; a no-op subscription where the module is absent. */
export function onChecks(listener: (change: ChecksChange) => void): { remove(): void } {
  return onRunnerEvent<unknown>('phonecandoChecks', (raw) => listener(asChecksChange(raw)));
}

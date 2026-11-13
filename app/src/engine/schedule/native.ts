// Engine seam for schedules (types.ts): the runner keeps them, sets the
// alarm for the soonest and gets each task to its agent at its time, with
// no JS around. The app lists and edits them, reads the runs log, and asks
// whether runs come on time (exact alarms). Native sends
// phonecandoSchedules on any change to the schedules or the runs. Every
// call is guarded: a native build without these reads as "not available"
// (no schedules, nothing saved).
import type { AgentId } from '../agents/records';
import type { AgentKindId } from '../agents/registry';
import { isRunnerAvailable, nativeRunner, onRunnerEvent, type RunnerModule } from '../runner';
import { asExact, asResult, asRunNow, asRuns, asSchedules } from './parse';
import type {
  RunNowResult,
  Schedule,
  ScheduleId,
  SchedulePatch,
  ScheduleResult,
  ScheduleRun,
  ScheduleSpec,
} from './types';

/** The runner keeps this many runs. */
export const RUNS_KEPT = 200;

/** Why a change was refused where this build has no schedules. */
const NOT_HERE = 'This version of the app has no schedules.';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function runner(): Partial<RunnerModule> {
  if (!isRunnerAvailable()) return {};
  try {
    return nativeRunner();
  } catch {
    return {};
  }
}

/** Whether this build has schedules at all. */
export function schedulesAvailable(): boolean {
  return typeof runner().listSchedules === 'function';
}

/** Every schedule; empty where the module or the method is absent. */
export function listSchedules(): Schedule[] {
  try {
    return asSchedules(runner().listSchedules?.());
  } catch {
    return [];
  }
}

/** The newest `limit` runs, newest first; empty where the module or the method is absent. */
export function scheduleRuns(limit: number = RUNS_KEPT): ScheduleRun[] {
  try {
    return asRuns(runner().scheduleRuns?.(limit));
  } catch {
    return [];
  }
}

export async function addSchedule(spec: ScheduleSpec): Promise<ScheduleResult> {
  const m = runner();
  if (typeof m.addSchedule !== 'function') return { ok: false, reason: NOT_HERE };
  try {
    return asResult(await m.addSchedule(spec), "Couldn't add it.");
  } catch (e) {
    return { ok: false, reason: errorText(e) };
  }
}

export async function updateSchedule(id: ScheduleId, patch: SchedulePatch): Promise<ScheduleResult> {
  const m = runner();
  if (typeof m.updateSchedule !== 'function') return { ok: false, reason: NOT_HERE };
  try {
    return asResult(await m.updateSchedule(id, patch), "Couldn't save it.");
  } catch (e) {
    return { ok: false, reason: errorText(e) };
  }
}

/** True once it is gone. */
export async function removeSchedule(id: ScheduleId): Promise<boolean> {
  const m = runner();
  if (typeof m.removeSchedule !== 'function') return false;
  try {
    return (await m.removeSchedule(id)) === true;
  } catch {
    return false;
  }
}

/** Runs it now (the app is in front, so the runner may start the agent). */
export async function runScheduleNow(id: ScheduleId): Promise<RunNowResult> {
  const m = runner();
  if (typeof m.runScheduleNow !== 'function') return { ok: false, reason: NOT_HERE };
  try {
    return asRunNow(await m.runScheduleNow(id), "Couldn't run it.");
  } catch (e) {
    return { ok: false, reason: errorText(e) };
  }
}

/** Whether runs come on time (Alarms & reminders allowed); null where this build can't tell. */
export function exactAlarms(): boolean | null {
  try {
    return asExact(runner().scheduleAlarms?.());
  } catch {
    return null;
  }
}

/** Opens Android's Alarms & reminders page for the app; false when it couldn't. */
export function openAlarmSettings(): boolean {
  try {
    return runner().openAlarmSettings?.() === true;
  } catch {
    return false;
  }
}

/** Whether this build can keep "Can schedule itself". */
export function canSetScheduleItself(): boolean {
  return typeof runner().setCanScheduleItself === 'function';
}

/** Whether the agent may schedule itself: on unless switched off (and on where this build can't tell). */
export function canScheduleItself(agentId: AgentId): boolean {
  try {
    return runner().canScheduleItself?.(agentId) !== false;
  } catch {
    return true;
  }
}

/** Saves "Can schedule itself" and returns it as kept; null when this build cannot keep it. */
export function setCanScheduleItself(agentId: AgentId, on: boolean): boolean | null {
  const m = runner();
  if (typeof m.setCanScheduleItself !== 'function') return null;
  try {
    return m.setCanScheduleItself(agentId, on) === true;
  } catch {
    return null;
  }
}

/** Whether agents of this kind can run schedules (a task at start, or woken by one); false where the build can't tell. */
export function kindRunsSchedules(kindId: AgentKindId): boolean {
  try {
    return runner().kindRunsSchedules?.(kindId) === true;
  } catch {
    return false;
  }
}

/** Every change to the schedules or the runs; a no-op subscription where the module is absent. */
export function onSchedules(listener: () => void): { remove(): void } {
  return onRunnerEvent<unknown>('phonecandoSchedules', () => listener());
}

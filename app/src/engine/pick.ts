// Android's own date and time dialogs, for forms that need a day or a time
// (the Schedules editor). Each resolves with what you picked, or null when
// you cancel, there is no screen, or this native build has no dialogs
// (pickAvailable says which, so a form can offer typing instead).
import { isRunnerAvailable, nativeRunner } from './runner';

export type PickedDate = { year: number; month: number; day: number };
export type PickedTime = { hour: number; minute: number };

export function pickAvailable(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return typeof nativeRunner().pickTime === 'function';
  } catch {
    return false;
  }
}

/** The day `initial` falls on to start with; only days between `minMs` and `maxMs` can be picked. */
export async function pickDate(initial: number, minMs: number, maxMs: number): Promise<number | null> {
  try {
    const d = new Date(initial);
    const picked = await nativeRunner().pickDate?.(d.getFullYear(), d.getMonth() + 1, d.getDate(), minMs, maxMs);
    return picked ? new Date(picked.year, picked.month - 1, picked.day).getTime() : null;
  } catch {
    return null;
  }
}

/** "HH:MM" on the 24-hour clock, starting at `initial` ("HH:MM"). */
export async function pickTime(initial: string): Promise<string | null> {
  try {
    const [h, m] = initial.split(':').map(Number);
    const picked = await nativeRunner().pickTime?.(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0);
    return picked ? `${String(picked.hour).padStart(2, '0')}:${String(picked.minute).padStart(2, '0')}` : null;
  } catch {
    return null;
  }
}

import { useEffect, useRef, useState } from 'react';
import { addSchedule, removeSchedule, runScheduleNow, updateSchedule } from '../../../engine/schedule/native';
import type { Schedule } from '../../../engine/schedule/types';
import { useScheduleStore } from '../../../state/schedule';
import { type Draft, patchOf, specOf } from '../logic/draft';
import { DELETE_FAILED, reasonText, runNowSent } from '../logic/scheduleCopy';

export type EditorNote = { text: string; error: boolean };
export type Busy = 'save' | 'run' | 'delete' | null;

// What the editor's buttons do: save (add a new schedule, or an edit's
// changes; nothing changed just closes), run now (as saved) and delete,
// each saying why when the runner refuses. Done, the list is re-read and
// the editor closes.
export function useScheduleActions(schedule: Schedule | null, onDone: () => void) {
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<EditorNote | null>(null);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const settle = (error: string | null) => {
    useScheduleStore.getState().refreshSchedules();
    if (!live.current) return;
    setBusy(null);
    if (error == null) onDone();
    else setNote({ text: error, error: true });
  };

  /** False when the form has a problem (the fields show it). */
  const save = async (draft: Draft): Promise<boolean> => {
    if (busy) return true;
    const now = Date.now();
    if (schedule) {
      const patch = patchOf(schedule, draft, now);
      if (!patch) return false;
      if (Object.keys(patch).length === 0) {
        onDone();
        return true;
      }
      setBusy('save');
      setNote(null);
      const r = await updateSchedule(schedule.id, patch);
      settle(r.ok ? null : reasonText(r.reason));
      return true;
    }
    const spec = specOf(draft, now);
    if (!spec) return false;
    setBusy('save');
    setNote(null);
    const r = await addSchedule(spec);
    settle(r.ok ? null : reasonText(r.reason));
    return true;
  };

  /** Runs it as saved; `dirty`: the form has changes not saved yet. */
  const runNow = async (dirty: boolean) => {
    if (!schedule || busy) return;
    setBusy('run');
    setNote(null);
    const r = await runScheduleNow(schedule.id);
    useScheduleStore.getState().refreshSchedules();
    if (!live.current) return;
    setBusy(null);
    setNote(r.ok ? { text: runNowSent(dirty), error: false } : { text: reasonText(r.reason), error: true });
  };

  const remove = async () => {
    if (!schedule || busy) return;
    setBusy('delete');
    setNote(null);
    const gone = await removeSchedule(schedule.id);
    settle(gone ? null : DELETE_FAILED);
  };

  return { busy, note, save, runNow, remove };
}

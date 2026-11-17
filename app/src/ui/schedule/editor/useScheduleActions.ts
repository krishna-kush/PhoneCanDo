import { useEffect, useRef, useState } from 'react';
import { addSchedule, removeSchedule, runScheduleNow, updateSchedule } from '../../../engine/schedule/native';
import type { Schedule } from '../../../engine/schedule/types';
import { useScheduleStore } from '../../../state/schedule';
import { type Draft, patchOf, specOf } from '../logic/draft';
import { DELETE_FAILED, runNowSent, type StampWord } from '../logic/editorCopy';
import { reasonText } from '../logic/scheduleCopy';

export type EditorNote = { text: string; error: boolean };
export type Busy = 'save' | 'run' | 'delete' | null;
/** The stamp on the work order; each one lands with a new key. */
export type Stamped = { word: StampWord; key: number };

/** How long a stamp shows: a filed or torn-up order's before the editor closes, a sent one's before it lifts. */
const STAMP_MS = 900;

// What the editor's buttons do: save (add a new schedule, or an edit's
// changes; nothing changed just closes), run now (as saved) and delete,
// each saying why when the runner refuses. Done, the list is re-read and
// the order is stamped (Scheduled, Updated or Void) for a moment, the
// form taking no more taps, before the editor closes; Run now stamps it
// Sent and stays.
export function useScheduleActions(schedule: Schedule | null, onDone: () => void) {
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<EditorNote | null>(null);
  const [stamp, setStamp] = useState<Stamped | null>(null);
  const [closing, setClosing] = useState(false);
  const live = useRef(true);
  const stamps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      live.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const land = (word: StampWord, then: () => void) => {
    stamps.current += 1;
    setStamp({ word, key: stamps.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (live.current) then();
    }, STAMP_MS);
  };

  const settle = (error: string | null, word: StampWord) => {
    useScheduleStore.getState().refreshSchedules();
    if (!live.current) return;
    setBusy(null);
    if (error != null) {
      setNote({ text: error, error: true });
      return;
    }
    setClosing(true);
    land(word, onDone);
  };

  /** False when the form has a problem (the fields show it). */
  const save = async (draft: Draft): Promise<boolean> => {
    if (busy || closing) return true;
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
      settle(r.ok ? null : reasonText(r.reason), 'saved');
      return true;
    }
    const spec = specOf(draft, now);
    if (!spec) return false;
    setBusy('save');
    setNote(null);
    const r = await addSchedule(spec);
    settle(r.ok ? null : reasonText(r.reason), 'added');
    return true;
  };

  /** Runs it as saved; `dirty`: the form has changes not saved yet. */
  const runNow = async (dirty: boolean) => {
    if (!schedule || busy || closing) return;
    setBusy('run');
    setNote(null);
    const r = await runScheduleNow(schedule.id);
    useScheduleStore.getState().refreshSchedules();
    if (!live.current) return;
    setBusy(null);
    setNote(r.ok ? { text: runNowSent(dirty), error: false } : { text: reasonText(r.reason), error: true });
    if (r.ok) land('sent', () => setStamp(null));
  };

  const remove = async () => {
    if (!schedule || busy || closing) return;
    setBusy('delete');
    setNote(null);
    const gone = await removeSchedule(schedule.id);
    settle(gone ? null : DELETE_FAILED, 'deleted');
  };

  return { busy, note, stamp, closing, save, runNow, remove };
}

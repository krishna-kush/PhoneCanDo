// App access for Settings (the Phone control row and the Apps page): the
// shared store (state/appAccess.ts), read again whenever the page is in
// front and the app comes back to it, since an agent's question changes the
// list from anywhere; and the changes, each that lets agents in further
// behind your fingerprint or screen lock first, and while Allow all apps is
// on every change to the blocked list too (logic/choices.ts). `msg`
// explains a refusal; empty when all went well.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { AppAccessApp } from '../../engine/appAccess';
import { confirmUser } from '../../engine/auth';
import { errorMessage } from '../../engine/errors/message';
import { useAppAccessStore } from '../../state/appAccess';
import { usePageActive } from '../nav/pageActive';
import {
  ALLOW_ALL_AUTH,
  ALLOW_ALL_TURNED_OFF,
  alwaysAuthTitle,
  biometricError,
  blockAuthTitle,
  NO_SCREEN_LOCK_LINE,
  NOT_CONFIRMED,
  SAVE_FAILED,
  unblockAuthTitle,
} from './copy';
import { allowAllNeedsConfirm, type AppTarget, goesAheadAnyway, needsConfirm, strongConfirm } from './logic/choices';

export type AppAccessView = ReturnType<typeof useAppAccess>;

export function useAppAccess() {
  const available = useAppAccessStore((s) => s.available);
  const allowAll = useAppAccessStore((s) => s.allowAll);
  const apps = useAppAccessStore((s) => s.apps);
  const inFront = usePageActive();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (inFront) useAppAccessStore.getState().refresh();
  }, [inFront]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') useAppAccessStore.getState().refresh();
    });
    return () => sub.remove();
  }, []);

  // True when the change may go ahead: no confirm needed, or it passed.
  async function confirmed(ask: boolean, title: string, strong: boolean): Promise<boolean> {
    if (!ask) return true;
    const auth = await confirmUser(title, { strong });
    if (auth === 'passed') return true;
    setMsg(auth === 'no_screen_lock' ? NO_SCREEN_LOCK_LINE : NOT_CONFIRMED);
    return false;
  }

  // A block's confirm: asked, but whatever comes back the block goes ahead.
  async function tryConfirm(title: string, strong: boolean): Promise<void> {
    try {
      await confirmUser(title, { strong });
    } catch {
      // A block never waits on the fingerprint.
    }
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMsg('');
    try {
      await work();
    } catch (e) {
      setMsg(biometricError(errorMessage(e)));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Moves one app: always, blocked, or none (asked again). While Allow all
   * apps is on, a block asks first so native can sign the list again and
   * keep Allow all on; unconfirmed, it still blocks and Allow all goes off.
   */
  function change(app: AppAccessApp, to: AppTarget) {
    if (busy || app.state === to) return;
    const all = useAppAccessStore.getState().allowAll;
    const ask = needsConfirm(app.state, to, all);
    const strong = strongConfirm(app.state, to, all);
    const title =
      to === 'always' ? alwaysAuthTitle(app.label) : to === 'blocked' ? blockAuthTitle(app.label) : unblockAuthTitle(app.label);
    return run(async () => {
      if (goesAheadAnyway(to)) {
        if (ask) await tryConfirm(title, strong);
        const ok = useAppAccessStore.getState().set(app.package, to);
        if (!ok) setMsg(SAVE_FAILED);
        else if (all && !useAppAccessStore.getState().allowAll) setMsg(ALLOW_ALL_TURNED_OFF);
        return;
      }
      if (!(await confirmed(ask, title, strong))) return;
      // With Allow all on, native refuses an unblock that no fresh confirm signed.
      if (!useAppAccessStore.getState().set(app.package, to)) setMsg(all && app.state === 'blocked' ? NOT_CONFIRMED : SAVE_FAILED);
    });
  }

  /** Allow all apps; on asks for the fingerprint first. */
  function setAllowAll(on: boolean) {
    if (busy || on === allowAll) return;
    return run(async () => {
      if (!(await confirmed(allowAllNeedsConfirm(on), ALLOW_ALL_AUTH, true))) return;
      if (!useAppAccessStore.getState().setAllowAll(on)) setMsg(SAVE_FAILED);
    });
  }

  return { available, allowAll, apps, busy, msg, change, setAllowAll };
}

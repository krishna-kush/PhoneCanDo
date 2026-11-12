import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { confirmUser, NO_SCREEN_LOCK } from '../../engine/auth';
import * as runner from '../../engine/runner';
import { track } from '../../engine/telemetry';
import { usePageActive } from '../nav/pageActive';

type LockState = { mode: runner.LockMode; unlocked: boolean; asking: number };

const runnerAvailable = runner.isRunnerAvailable();

function read(): LockState {
  return {
    mode: runner.getLockMode(),
    unlocked: runner.isAutomationEnabled(),
    asking: runner.askUnlockCount(),
  };
}

// Settings' view of the phone-control lock: the mode, whether it is
// unlocked (or, in ask mode, how many agents hold their own unlock), and
// the user's actions on it, each behind the fingerprint or PIN except
// locking. Read again on resume and when Settings is in front, since the
// in-chat dialog, an agent handing the phone back and a restart all change
// it elsewhere. `msg` explains a refusal; empty when all went well.
export function useControlLock() {
  const inFront = usePageActive();
  const [state, setState] = useState<LockState>(() =>
    runnerAvailable ? read() : { mode: 'install', unlocked: false, asking: 0 },
  );
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => {
    if (runnerAvailable) setState(read());
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => sub.remove();
  }, [sync]);

  useEffect(() => {
    if (inFront) sync();
  }, [inFront, sync]);

  // Install mode saves the unlock, which needs a fingerprint or the screen
  // lock: Android's Keystore takes nothing weaker.
  async function unlock() {
    setBusy(true);
    setMsg('');
    try {
      const auth = await confirmUser('Unlock phone control', { strong: state.mode === 'install' });
      if (auth !== 'passed') {
        setMsg(auth === 'no_screen_lock' ? NO_SCREEN_LOCK : 'Not unlocked.');
        return;
      }
      const ok = runner.setAutomationEnabled(true);
      if (ok) track('control.unlock');
      // Unlocked shows no text under the button; only a failure explains itself.
      setMsg(ok ? '' : 'This install has no phone-control driver; rebuild the app.');
    } catch (e) {
      setMsg(`Biometric error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      sync();
      setBusy(false);
    }
  }

  // Locking needs no biometric; it also ends every ask-mode unlock.
  function lock() {
    runner.setAutomationEnabled(false);
    setMsg('');
    sync();
  }

  // Every change asks first, looser or stricter: an agent with phone
  // control could otherwise tap its way to "Once" in this very screen.
  async function changeMode(next: runner.LockMode) {
    if (next === state.mode) return;
    setBusy(true);
    setMsg('');
    try {
      const auth = await confirmUser('Change how often phone control asks', { strong: true });
      if (auth !== 'passed') {
        setMsg(auth === 'no_screen_lock' ? NO_SCREEN_LOCK : 'Not changed.');
        return;
      }
      if (!runner.setLockMode(next)) setMsg('Not saved; phone control is locked. Try again.');
    } catch (e) {
      setMsg(`Biometric error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      sync();
      setBusy(false);
    }
  }

  return { ...state, msg, busy, unlock, lock, changeMode };
}

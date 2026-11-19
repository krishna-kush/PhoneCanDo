// When Auto off's offer shows: once, after the switch's first turn-on on
// this install (native marks it then; a switch that was on before never
// brings it), with PhoneCanDo in front again and the switch still on. It
// waits for what is going on
// already: the license gate, a switch still starting, an agent driving the
// phone (one that asked for the switch takes it first) and a first shift
// walk (Give me hands ends at this very switch, so its DONE stamp comes
// first). It looks again every few seconds until those are done.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as runner from '../../../engine/runner';
import { useAppStore } from '../../../state/app';
import { useAutoOffStore } from '../../../state/autoOff';
import { useStarterStore } from '../../../state/starter';

const AGAIN_MS = 5_000;

export function useAutoOffAsk(): boolean {
  const offerDue = useAutoOffStore((s) => s.offerDue);
  const agreed = useAppStore((s) => s.hydrated && s.licenseAgreed !== null);
  const walking = useStarterStore((s) => s.walk != null && !s.walk.quiet);
  const [ready, setReady] = useState(false);

  // The offer is marked natively while the app is away, in Android's settings.
  useEffect(() => {
    const { refresh } = useAutoOffStore.getState();
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setReady(false);
    if (!offerDue || !agreed || walking) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const look = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (AppState.currentState !== 'active') return;
      // Switched off again before you came back: it waits for the next turn-on.
      const connected = runner.isUiAutomationConnected();
      if (!connected && !runner.isAccessibilityServiceEnabled()) return;
      // Switched on and still starting, or an agent drives: look again soon.
      if (!connected || runner.isPhoneInUse()) {
        timer = setTimeout(look, AGAIN_MS);
        return;
      }
      setReady(true);
    };
    look();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') look();
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [offerDue, agreed, walking]);

  return ready && offerDue;
}

// When Auto off's offer shows: after the switch's first turn-on on this
// install (native marks it then; a switch that was on before never brings
// it), while the switch is still on and PhoneCanDo is in front. An agent
// that asked for the switch waits for the answer at the bridge
// (PromptFlows), so it never drives over it. Read on mount and at every
// return to the app; a switch flipped on just as you came back connects a
// moment later, so that one is read again shortly.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as runner from '../../../engine/runner';
import { useAutoOffStore } from '../../../state/autoOff';

const STARTING_MS = 1_500;

export function useAutoOffAsk(): boolean {
  const offerDue = useAutoOffStore((s) => s.offerDue);
  const [here, setHere] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const look = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      useAutoOffStore.getState().refresh();
      const front = AppState.currentState === 'active';
      const connected = runner.isUiAutomationConnected();
      const on = connected || runner.isAccessibilityServiceEnabled();
      setHere(front && on);
      if (front && on && !connected) timer = setTimeout(look, STARTING_MS);
    };
    look();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') look();
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return offerDue && here;
}

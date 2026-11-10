import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { PtyTransport } from './transport/types';

// Tells an open transport whether the view shows its program: on screen
// (`active`; TabPager keeps every page mounted) with the app in front. An
// engine's PTY passes it on as focus reports, so a TUI that notifies only
// while unfocused does so whenever nobody looks. Told once the transport
// is open (after an attach's replay) and on every change.
export function useViewFocus(transport: PtyTransport | null, active: boolean) {
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const shown = active && appActive;
  useEffect(() => {
    if (!transport?.focus) return;
    try {
      transport.focus(shown);
    } catch {
      // the engine is gone; its end reaches the view through reads
    }
  }, [transport, shown]);
}

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Whether the app is in the foreground, kept up to date as it comes and goes. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

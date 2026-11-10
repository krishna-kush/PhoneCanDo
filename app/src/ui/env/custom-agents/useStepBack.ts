import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useAppStore } from '../../../state/app';

// Android Back on a page's second step (a review) goes to its first step
// instead of up a page. Registered only while that step shows, after the
// Env tab's own listener (useEnvBack), so it runs first; like that one it
// stands aside while another tab, the terminal or the folder picker is up.
export function useStepBack(active: boolean, back: () => void) {
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const app = useAppStore.getState();
      if (app.footerTab !== 'env' || app.terminal || app.folderPickerOpen) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [active, back]);
}

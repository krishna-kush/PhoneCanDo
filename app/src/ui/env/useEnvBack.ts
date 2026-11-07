import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useAppStore } from '../../state/app';
import { useEnvNav } from './nav';

// Android Back inside the Env tab walks up its pages before the app's own
// handler (useAndroidBack) leaves the tab. Registered only while a sub-page
// shows, so it is always the newest listener and runs first.
export function useEnvBack(onSubPage: boolean) {
  useEffect(() => {
    if (!onSubPage) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const app = useAppStore.getState();
      // The pager keeps this tab mounted under the others and the terminal.
      if (app.footerTab !== 'env' || app.terminal || app.folderPickerOpen) return false;
      return useEnvNav.getState().back();
    });
    return () => sub.remove();
  }, [onSubPage]);
}

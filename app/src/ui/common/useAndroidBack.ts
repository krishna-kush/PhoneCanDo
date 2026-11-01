import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useAppStore } from '../../state/app';
import { webGoBack } from '../chat/webNavigation';

// Central Android back behavior: walk the same stack the UI shows
// (terminal -> folder picker -> home tab -> web history) instead of exiting
// the app immediately. Returns true (consumed) for every in-app step; only
// the opencode home lets the OS handle the press (exit). Register once in App.
export function useAndroidBack() {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const s = useAppStore.getState();
      if (s.terminalDir) {
        s.closeTerminal();
        return true;
      }
      if (s.folderPickerOpen) {
        s.setFolderPickerOpen(false);
        return true;
      }
      if (s.footerTab !== 'home') {
        s.setFooterTab('home');
        return true;
      }
      if (webGoBack()) return true;
      return false;
    });
    return () => sub.remove();
  }, []);
}

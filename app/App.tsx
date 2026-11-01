import { useEffect, useState } from 'react';
import { AppState, Keyboard, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { TamaguiProvider } from 'tamagui';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './src/ui/common/AppHeader';
import FooterTabs from './src/ui/common/FooterTabs';
import TabPager, { TAB_ORDER } from './src/ui/common/TabPager';
import { useAndroidBack } from './src/ui/common/useAndroidBack';
import ChatWebScreen from './src/ui/chat/ChatWebScreen';
import TerminalScreen from './src/ui/terminal/TerminalScreen';
import FolderPicker from './src/ui/terminal/FolderPicker';
import EnvScreen from './src/ui/env/EnvScreen';
import SettingsScreen from './src/ui/settings/SettingsScreen';
import AccessibilityDialog from './src/ui/common/AccessibilityDialog';
import RootError from './src/diagnostics/RootError';
import UnlockDialog from './src/ui/common/UnlockDialog';
import UpdateDialog from './src/ui/common/UpdateDialog';
import { useAppStore } from './src/state/app';
import { ensureServeRunning } from './src/engine/ensureServe';
import {
  consumeLaunchTab,
  isRunnerAvailable,
  onLaunchTab,
  requestNotificationPermission,
} from './src/engine/runner';
import { useScheme, useTheme } from './src/ui/common/globals';
import tamaguiConfig from './tamagui.config';

export default function App() {
  const scheme = useScheme();
  const t = useTheme();
  // Geist Mono for the site's mono labels. A system font overlay can replace
  // even Android's generic `monospace`, so the app ships the family itself.
  const [fontsLoaded, fontError] = useFonts({
    'GeistMono-Regular': require('./assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Bold': require('./assets/fonts/GeistMono-Bold.ttf'),
  });
  const hydrate = useAppStore((s) => s.hydrate);
  const footerTab = useAppStore((s) => s.footerTab);
  const setFooterTab = useAppStore((s) => s.setFooterTab);
  const terminalDir = useAppStore((s) => s.terminalDir);
  const folderPickerOpen = useAppStore((s) => s.folderPickerOpen);
  // Standard tabBarHideOnKeyboard behavior: the footer is dead space
  // behind the keyboard (it also lifts terminal content by its height),
  // so it unmounts while any keyboard is up and returns after.
  const [kbVisible, setKbVisible] = useState(false);

  // Android system back walks chat -> project -> home tab before exiting.
  useAndroidBack();

  useEffect(() => {
    // The agent can ask the app to come back (mobile_return) or open the
    // Phone control screen (mobile_request_unlock). The event covers the
    // already-foreground case; the pref covers a cold/resumed start.
    const applyLaunchTab = (tab: string) => {
      if (tab === 'home' || tab === 'env' || tab === 'settings') {
        Keyboard.dismiss();
        setFooterTab(tab);
      }
    };
    const launchSub = onLaunchTab((tab) => {
      consumeLaunchTab(); // clear the persisted hint once handled
      applyLaunchTab(tab);
    });
    applyLaunchTab(consumeLaunchTab());
    // System notification grant (Android 13+ drops posts without it).
    // Asked once natively; afterwards it lives in Settings.
    try {
      if (isRunnerAvailable()) requestNotificationPermission();
    } catch {
      // no activity yet — Settings retry covers it
    }
    // Engine autostart on launch (health-gated): a warm engine keeps chat
    // opens instant. Deferred so the first frame paints before the blocking
    // health probe. The service owns the port — adopt the effective one.
    // Quiet shutdown on idle-close still applies (see usePtySession/store).
    void hydrate().finally(() => {
      setTimeout(() => {
        try {
          const requested = useAppStore.getState().enginePort;
          const res = ensureServeRunning(requested);
          if (res.port !== requested) void useAppStore.getState().setEnginePort(res.port);
        } catch {
          // engine down — terminal/web open re-ensures on demand
        }
      }, 500);
    });
    const sub = AppState.addEventListener('change', (state) => {
      // Engine lifetime follows UI visibility: background stops it when idle
      // (quietEngineIfIdle), foreground return restarts a stopped engine.
      // All branches no-op when there is nothing to do.
      if (state === 'background') {
        void useAppStore.getState().quietEngineIfIdle();
      } else if (state === 'active') {
        applyLaunchTab(consumeLaunchTab());
        try {
          const st = useAppStore.getState();
          const requested = st.enginePort;
          const res = ensureServeRunning(requested);
          if (res.port !== requested) void st.setEnginePort(res.port);
        } catch {
          // engine down — next open re-ensures
        }
      }
    });
    const show = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => {
      launchSub.remove();
      sub.remove();
      show.remove();
      hide.remove();
    };
  }, [hydrate, setFooterTab]);

  // Keep the first frame blank rather than flash the system font. If loading
  // fails, render anyway (the fallback is the old sans, not a dead app).
  if (!fontsLoaded && !fontError) return null;

  return (
    <RootError>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={scheme}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <KeyboardProvider>
        <SafeAreaProvider>
          <SafeAreaView
            style={{ flex: 1, backgroundColor: t.panel }}
            edges={['top', 'bottom', 'left', 'right']}
          >
            <AppHeader />
            {terminalDir ? (
              <TerminalScreen key={terminalDir} />
            ) : folderPickerOpen ? (
              <FolderPicker />
            ) : (
              // Home IS the web UI (pair-loaded opencode home — projects and
              // sessions live there, no app-side project/chat creation).
              // Terminal opens above via the header menu + folder picker.
              <TabPager
                pages={[<ChatWebScreen key="web" />, <EnvScreen key="env" />, <SettingsScreen key="settings" />]}
                index={TAB_ORDER.indexOf(footerTab)}
                onIndexChange={(i) => setFooterTab(TAB_ORDER[i])}
              />
            )}
            {!kbVisible && terminalDir == null && !folderPickerOpen && <FooterTabs />}
          </SafeAreaView>
          <UnlockDialog />
          <AccessibilityDialog />
          <UpdateDialog />
        </SafeAreaProvider>
        </KeyboardProvider>
      </TamaguiProvider>
    </RootError>
  );
}

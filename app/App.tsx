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
import FirstLaunchScreen from './src/ui/setup/FirstLaunchScreen';
import AccessibilityDialog from './src/ui/accessibility/AccessibilityDialog';
import RootError from './src/diagnostics/RootError';
import UnlockDialog from './src/ui/common/UnlockDialog';
import UpdateDialog from './src/ui/common/UpdateDialog';
import { useAgentsStore } from './src/state/agents';
import { useAppStore } from './src/state/app';
import {
  consumeLaunchTarget,
  isRunnerAvailable,
  onLaunchTarget,
  requestNotificationPermission,
  type LaunchTarget,
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
  const terminal = useAppStore((s) => s.terminal);
  const folderPickerOpen = useAppStore((s) => s.folderPickerOpen);
  const agentsHydrated = useAgentsStore((s) => s.hydrated);
  const hasAgents = useAgentsStore((s) => s.agents.length > 0);
  // Standard tabBarHideOnKeyboard behavior: the footer is dead space
  // behind the keyboard (it also lifts terminal content by its height),
  // so it unmounts while any keyboard is up and returns after.
  const [kbVisible, setKbVisible] = useState(false);

  // Android system back walks chat -> project -> home tab before exiting.
  useAndroidBack();

  useEffect(() => {
    // Where to land when the app opens for a reason: a tap on an agent's
    // notification (its alert, its own post, its prompt, its return notice)
    // or an agent bringing the app back (mobile_return). The target names a
    // tab and, when the reason is one agent, that agent, which becomes the
    // active one. The event covers the app in front; the pref covers a cold
    // or resumed start. Until the agents are read, a switch would be undone
    // by the stored pick, so the target waits for hydration.
    const applyLaunchTarget = (target: LaunchTarget | null) => {
      if (!target) return;
      Keyboard.dismiss();
      const agents = useAgentsStore.getState();
      if (target.agentId && target.agentId !== agents.activeAgentId) void agents.setActiveAgent(target.agentId);
      setFooterTab(target.tab);
    };
    const takeLaunchTarget = () => {
      if (useAgentsStore.getState().hydrated) applyLaunchTarget(consumeLaunchTarget());
    };
    const launchSub = onLaunchTarget((target) => {
      if (!useAgentsStore.getState().hydrated) return; // the pref keeps it for hydration's end
      consumeLaunchTarget(); // clear the persisted copy once handled
      applyLaunchTarget(target);
    });
    // System notification grant (Android 13+ drops posts without it).
    // Asked once natively; afterwards it lives in Settings.
    try {
      if (isRunnerAvailable()) requestNotificationPermission();
    } catch {
      // no activity yet — Settings retry covers it
    }
    // The active agent's engine starts on launch and on every return to the
    // foreground (a warm engine keeps chat opens instant; the service starts
    // nothing by itself after the system killed it). Fire-and-forget: the
    // web UI and terminal start it again when they open. Other agents'
    // engines start only when something uses them.
    const startActiveAgent = () => {
      const { activeAgentId, startAgent } = useAgentsStore.getState();
      if (activeAgentId) void startAgent(activeAgentId);
    };
    void Promise.allSettled([hydrate(), useAgentsStore.getState().hydrateAgents()]).finally(() => {
      takeLaunchTarget();
      // Usage stats: deferred and fire-and-forget, never on the boot path.
      void useAppStore.getState().startTelemetry();
      setTimeout(startActiveAgent, 500);
    });
    const sub = AppState.addEventListener('change', (state) => {
      // Engine lifetime follows UI visibility: background stops every idle
      // engine (stopIdleAgents), foreground return restarts the active
      // agent's. All branches no-op when there is nothing to do.
      if (state === 'background') {
        void useAgentsStore.getState().stopIdleAgents();
      } else if (state === 'active') {
        takeLaunchTarget();
        useAgentsStore.getState().refreshAgents();
        startActiveAgent();
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

  // Keep the first frame blank rather than flash the system font (if loading
  // fails, render anyway: the fallback is the old sans, not a dead app) or
  // the tabs before we know whether any agent exists.
  if ((!fontsLoaded && !fontError) || !agentsHydrated) return null;

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
            {!hasAgents ? (
              // No agent yet: setup creates the first one, then the tabs show.
              <FirstLaunchScreen />
            ) : (
              <>
                <AppHeader />
                {terminal ? (
                  <TerminalScreen key={terminal.id} session={terminal} />
                ) : folderPickerOpen ? (
                  <FolderPicker />
                ) : (
                  // Home IS the active agent's web UI (its pair-loaded home —
                  // projects and sessions live there, no app-side project/chat
                  // creation). Terminals open above via the header menu.
                  <TabPager
                    pages={[<ChatWebScreen key="web" />, <EnvScreen key="env" />, <SettingsScreen key="settings" />]}
                    index={TAB_ORDER.indexOf(footerTab)}
                    onIndexChange={(i) => setFooterTab(TAB_ORDER[i])}
                  />
                )}
                {!kbVisible && terminal == null && !folderPickerOpen && <FooterTabs />}
              </>
            )}
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

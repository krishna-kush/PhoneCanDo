import { useEffect, useState } from 'react';
import { AppState, StatusBar, View } from 'react-native';
import { useFonts } from 'expo-font';
import { TamaguiProvider } from 'tamagui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';
import HomeHeader from './src/ui/chat/HomeHeader';
import HomeScreen from './src/ui/chat/HomeScreen';
import AppDrawer from './src/ui/drawer/AppDrawer';
import PageStack from './src/ui/nav/PageStack';
import { applyLaunchTarget } from './src/ui/nav/launchTarget';
import { useBackChain } from './src/ui/nav/useBackChain';
import { useShareLinkOpen } from './src/ui/recommend/useShareLinkOpen';
import { useSettingsSync } from './src/ui/account/useSettingsSync';
import { useMascotPicks } from './src/ui/common/face/useMascotPicks';
import { useDeskSeats } from './src/ui/common/desk/useDeskSeats';
import { useEngineTerminalTheme } from './src/ui/terminal/theme/useEngineTerminalTheme';
import FirstLaunchScreen from './src/ui/setup/FirstLaunchScreen';
import AccessibilityDialog from './src/ui/accessibility/AccessibilityDialog';
import RootError from './src/diagnostics/RootError';
import SafeRoot from './src/ui/common/SafeRoot';
import OpenUrlDialog from './src/ui/common/OpenUrlDialog';
import PermissionDialog from './src/ui/chat/background/PermissionDialog';
import UnlockDialog from './src/ui/common/UnlockDialog';
import UpdateBox from './src/ui/update/UpdateBox';
import ThemeCurtain from './src/ui/settings/look/ThemeCurtain';
import KeyboardTracker from './src/ui/common/keyboard/KeyboardTracker';
import MemoryGuard from './src/ui/memory/MemoryGuard';
import RecommendCard from './src/ui/recommend/RecommendCard';
import HelloSheet from './src/ui/starter/HelloSheet';
import ShiftCard from './src/ui/starter/ShiftCard';
import ShiftSignals from './src/ui/starter/ShiftSignals';
import WalkGuide from './src/ui/starter/walk/WalkGuide';
import { useAgentsStore } from './src/state/agents';
import { useAppStore } from './src/state/app';
import { useChecksStore } from './src/state/checks';
import { useLinuxStore } from './src/state/linux';
import { useMemoryStore } from './src/state/memory';
import { useModelsStore } from './src/state/models';
import {
  consumeLaunchTarget,
  isRunnerAvailable,
  onLaunchTarget,
  requestNotificationPermission,
} from './src/engine/runner';
import { hideSplash, holdSplash } from './src/engine/splash';
import { useScheme, useTheme } from './src/ui/common/globals';
import tamaguiConfig from './tamagui.config';

// The launch splash stays up until the first real frame lays out (below),
// not just React Native's first content, which is our blank wait.
holdSplash();

// The first frame waits on these two reads (prefs, the agents), so they go
// out now, before App's first render and ahead of every other stored read,
// and run while the effect below makes its synchronous native reads.
const boot = Promise.allSettled([useAppStore.getState().hydrate(), useAgentsStore.getState().hydrateAgents()]);

export default function App() {
  const scheme = useScheme();
  const t = useTheme();
  // Geist Mono for the site's mono labels. A system font overlay can replace
  // even Android's generic `monospace`, so the app ships the family itself.
  const [fontsLoaded, fontError] = useFonts({
    'GeistMono-Regular': require('./assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Bold': require('./assets/fonts/GeistMono-Bold.ttf'),
  });
  const prefsHydrated = useAppStore((s) => s.hydrated);
  const agentsHydrated = useAgentsStore((s) => s.hydrated);
  const hasAgents = useAgentsStore((s) => s.agents.length > 0);
  const setUp = useAppStore((s) => s.setUp);
  // First launch: no agent, and setup never ran here. The setup screen
  // stays for its finale once the first agent exists, then lets Home show.
  // It runs once ever: with every agent deleted later, Home offers a new
  // one instead (chat/noAgents/).
  const [inSetup, setInSetup] = useState(false);
  if (agentsHydrated && prefsHydrated && !hasAgents && !setUp && !inSetup) setInSetup(true);
  // An agent here means setup has run, on installs from before the flag too.
  useEffect(() => {
    if (prefsHydrated && hasAgents && !setUp) void useAppStore.getState().markSetUp();
  }, [prefsHydrated, hasAgents, setUp]);

  // Android Back walks what the screen shows: a step inside a page, the
  // drawer, the top page, the web UI's history, then leaves the app.
  useBackChain();

  // The TUI engines' terminals answer in the app's scheme, shown or not.
  useEngineTerminalTheme();

  // A friend's share link opening the app (phonecando.app/i/<code>).
  useShareLinkOpen();

  // A signed-in person's settings follow them to their other phones.
  useSettingsSync();
  useMascotPicks();
  useDeskSeats();

  useEffect(() => {
    // Where to land when the app opens for a reason: a tap on a
    // notification or an agent bringing the app back (mobile_return);
    // applyLaunchTarget (ui/nav/launchTarget.ts) says where each lands. The
    // event covers the app in front; the pref covers a cold or resumed
    // start. Until the agents are read, a switch would be undone by the
    // stored pick, so the target waits for hydration.
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
    // The drawer, the systems and the agent pages read these.
    useLinuxStore.getState().hydrateLinux();
    useModelsStore.getState().hydrateModels();
    // The RAM warning listens from launch: it may need to speak first.
    useMemoryStore.getState().hydrateMemory();
    void boot.finally(() => {
      takeLaunchTarget();
      // Each kind's messaging level now, which the kind list and the
      // messages rows show; nothing on Home does, so it waits for the
      // first frame.
      requestIdleCallback(() => useChecksStore.getState().hydrateChecks());
      // Usage stats: deferred and fire-and-forget, never on the boot path.
      void useAppStore.getState().startTelemetry();
      setTimeout(startActiveAgent, 500);
    });
    const sub = AppState.addEventListener('change', (state) => {
      // A foreground return restarts the active agent's engine. In the
      // background the runner stops each agent idle with no job left by
      // itself (its work watch), once the app has been away a while.
      if (state === 'active') {
        takeLaunchTarget();
        useAgentsStore.getState().refreshAgents();
        useMemoryStore.getState().refreshMemory();
        startActiveAgent();
      }
    });
    return () => {
      launchSub.remove();
      sub.remove();
    };
  }, []);

  // Keep the first frame blank, under the splash, rather than flash the
  // system font (if loading fails, render anyway: the fallback is the old
  // sans, not a dead app), the other theme before the stored one is read, or
  // Home before we know whether any agent exists.
  if ((!fontsLoaded && !fontError) || !prefsHydrated || !agentsHydrated) return null;

  return (
    <RootError>
      {/* Gestures that run on the UI thread (the drawer's swipe) need this root. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={scheme}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <KeyboardProvider>
        {/* The window's insets from the first frame: without them the
            header drew under the status bar until they arrived. */}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <KeyboardTracker />
          <SafeRoot backgroundColor={t.panel} onLayout={hideSplash}>
            {inSetup ? (
              // First launch: setup creates the first agent, then Home shows.
              <FirstLaunchScreen onFinished={() => setInSetup(false)} />
            ) : (
              // One box inside the safe area: the pages and the drawer are
              // absolute layers, which SafeRoot's padding would not hold.
              <View style={{ flex: 1 }}>
                {/* Home IS the active agent's own UI: its pair-loaded web UI
                    (projects and sessions live there, no app-side project/chat
                    creation) or the TUI its engine runs. Every other place is a
                    page over it; the drawer leads to them. */}
                <PageStack
                  home={
                    <YStack flex={1}>
                      <HomeHeader />
                      <HomeScreen />
                      {/* While the first shift runs: how far along, the next job. */}
                      <ShiftCard />
                      {/* Now and then, after a run finished in front of you. */}
                      <RecommendCard />
                    </YStack>
                  }
                />
                <AppDrawer />
                {/* Over Home, the pages and the drawer: the RAM warning. */}
                <MemoryGuard />
                {/* Once, as the first agent comes up: hello, and the first shift's offer. */}
                <HelloSheet />
                <ShiftSignals />
                {/* A mission's Lead the way: the guide over everything. */}
                <WalkGuide />
              </View>
            )}
          </SafeRoot>
          <UnlockDialog />
          <AccessibilityDialog />
          <OpenUrlDialog />
          <PermissionDialog />
          <UpdateBox />
          <ThemeCurtain />
        </SafeAreaProvider>
        </KeyboardProvider>
      </TamaguiProvider>
      </GestureHandlerRootView>
    </RootError>
  );
}

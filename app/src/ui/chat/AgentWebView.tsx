import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text, YStack } from 'tamagui';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { WebView } from 'react-native-webview';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { lastPage, rememberPage, restoreUrl } from './lastPage';
import { useOpenChat } from './useOpenChat';
import { setWebBackHandler, setWebHomeHandler } from './webNavigation';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { engineConn, waitForEngine } from '../../engine/connection';
import { isRunnerAvailable } from '../../engine/runner';
import { track } from '../../engine/telemetry';
import AppButton from '../common/AppButton';
import LogoLoader from '../common/LogoLoader';
import { useTheme } from '../common/globals';

// One agent's web UI in a WebView, signed in with a fresh one-time pairing
// URL per mount (the agent kind's pairUrl). ChatWebScreen mounts one per
// active agent, so a switch pairs again, lands on the web home (projects and
// sessions live there; no app-side chats) and then returns to the page that
// agent was last on (lastPage.ts). App chrome adds a web-history back arrow
// and a Home action so a session never strands the user; the TUI
// (`TerminalScreen`) is untouched — the header menu switches views. Theme
// and embed scripts come from the kind's web adapter.
export default function AgentWebView({ agent }: { agent: Agent }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Covers the first document load (an unthemed paint) and the restore of
  // the last page. Never tied to onLoadStart: on Android that fires for
  // every history change, in-page ones too, while onLoadEnd fires only when
  // a document finishes, so going back to an in-page entry left the cover
  // up for good.
  const [covered, setCovered] = useState(true);
  const restoreRef = useRef(lastPage(agent.id));
  // The chat the page shows, if any: the service notification leaves it out.
  const [chatId, setChatId] = useState<string | null>(null);
  const web = useRef<WebView<object>>(null);
  const canGoBackRef = useRef(false);
  const currentUrlRef = useRef('');
  const homeUrlRef = useRef<string | null>(null);
  const setWebCanGoBack = useAppStore((s) => s.setWebCanGoBack);
  const themeMode = useAppStore((s) => s.themeMode);
  const t = useTheme();
  const kind = agentKind(agent.kind);
  useOpenChat(agent.id, chatId);

  // The web UI owns its history and its project-list home. Chrome calls these
  // handlers so Android back, the header back arrow, and the Home menu item
  // never strand the user in a session. Back works on every page but the
  // home: through the web history when it has an entry, else straight home.
  // Chromium hides entries the user never touched (the home a restore passes
  // through), so a restored page has no history to go back to.
  useEffect(() => {
    const goHome = () => {
      const home = homeUrlRef.current;
      if (!home || !web.current) return false;
      if (currentUrlRef.current === home) return true;
      web.current.injectJavaScript(`window.location.href = ${JSON.stringify(home)}; true;`);
      return true;
    };
    setWebBackHandler(() => {
      const home = homeUrlRef.current;
      if (!home || !web.current || currentUrlRef.current === home) return false;
      if (canGoBackRef.current) web.current.goBack();
      else goHome();
      return true;
    });
    setWebHomeHandler(goHome);
    return () => {
      // Remembered on the way out, so a switch back reopens this page.
      const last = currentUrlRef.current;
      if (last && !kind.web.isAuthUrl(last)) rememberPage(agent.id, last);
      setWebBackHandler(null);
      setWebHomeHandler(null);
      setWebCanGoBack(false);
    };
  }, [setWebCanGoBack, agent.id, kind]);

  // The web app stays mounted across app theme changes; re-assert the scheme
  // in place so the session/scroll state survives the switch.
  useEffect(() => {
    web.current?.injectJavaScript(kind.web.themeScript(themeMode, t));
  }, [themeMode, t, kind]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isRunnerAvailable()) throw new Error('native module unavailable');
        const agentId = agent.id;
        const res = await useAgentsStore.getState().startAgent(agentId);
        if (res.status === 'unavailable') throw new Error('engine unavailable');
        if (res.port == null) throw new Error(res.error ?? res.status);
        if (res.status !== 'already-running') {
          await waitForEngine(agentId);
        }
        const conn = engineConn(agentId);
        const pairUrl = await kind.pairUrl(conn);
        if (!cancelled) {
          // Log the base (never the single-use URL) for diagnostics.
          console.log(`[phonecando] web pair ok base=${conn.baseUrl}`);
          setUrl(pairUrl);
          track('chat.open');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (error) {
    return (
      <YStack flex={1} backgroundColor={t.bg} padding="$4" gap="$3" justifyContent="center">
        <Text color={t.primary} fontFamily="$mono">
          Web UI error: {error}
        </Text>
        <AppButton
          variant="secondary"
          onPress={() => {
            setError(null);
            setUrl(null);
            setAttempt((a) => a + 1);
          }}
        >
          Retry
        </AppButton>
      </YStack>
    );
  }

  if (url == null) {
    return (
      <YStack
        flex={1}
        backgroundColor={t.bg}
        padding="$3"
        gap="$4"
        alignItems="center"
        justifyContent="center"
      >
        <LogoLoader size={24} />
        <Text color={t.fg} fontFamily="$mono">
          Loading web UI…
        </Text>
      </YStack>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="height"
      automaticOffset
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {/* WebView<object>: react-native-webview 13.16.2 defaults its extra-props
            type to `undefined`, which leaves no prop valid; object types the same
            on every version. */}
        <WebView<object>
          ref={web}
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: t.bg }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          injectedJavaScriptBeforeContentLoaded={kind.web.themeScript(themeMode, t)}
          onLoadEnd={(e) => {
            web.current?.injectJavaScript(kind.web.themeScript(themeMode, t));
            const loaded = e.nativeEvent.url;
            if (!kind.web.isAuthUrl(loaded)) {
              const target = restoreUrl(loaded, restoreRef.current);
              restoreRef.current = null;
              if (target) {
                // Replaces the home it passed through; back from it goes home.
                web.current?.injectJavaScript(`window.location.replace(${JSON.stringify(target)}); true;`);
                return;
              }
            }
            setCovered(false);
          }}
          onNavigationStateChange={(nav) => {
            currentUrlRef.current = nav.url;
            setChatId(kind.web.isAuthUrl(nav.url) ? null : kind.web.sessionOf(nav.url));
            if (!homeUrlRef.current && nav.url && !kind.web.isAuthUrl(nav.url)) {
              homeUrlRef.current = nav.url;
            }
            canGoBackRef.current = nav.canGoBack;
            setWebCanGoBack(homeUrlRef.current != null && homeUrlRef.current !== nav.url);
          }}
          injectedJavaScript={kind.web.embedScript}
          onHttpError={(e) => {
            const code = e.nativeEvent.statusCode;
            if (code === 401 || code === 403) {
              setError(`web UI refused auth (http ${code}) — retry re-pairs`);
            }
          }}
          onError={(e) => {
            setError(e.nativeEvent.description || 'web view failed to load');
          }}
        />
        {covered ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.bg,
            }}
          >
            <LogoLoader size={24} />
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

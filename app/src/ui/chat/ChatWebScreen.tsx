import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text, YStack } from 'tamagui';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { WebView } from 'react-native-webview';
import { useAppStore } from '../../state/app';
import { setWebBackHandler, setWebHomeHandler } from './webNavigation';
import { activeAgentKind } from '../../engine/agents/registry';
import { engineConn, waitForEngine } from '../../engine/connection';
import { ensureServeRunning } from '../../engine/ensureServe';
import { engineBaseUrl, isRunnerAvailable } from '../../engine/runner';
import { track } from '../../engine/telemetry';
import AppButton from '../common/AppButton';
import LogoLoader from '../common/LogoLoader';
import { useTheme } from '../common/globals';

// Default chat view: the agent's web UI in a WebView, signed in with a fresh
// one-time pairing URL per mount (the agent kind's pairUrl). Lands on the web
// home (projects and sessions live there; no app-side chats). App chrome
// adds a web-history back arrow and a Home action so a session never strands
// the user; the TUI (`TerminalScreen`) is untouched — the header menu
// switches views. Theme and embed scripts come from the kind's web adapter.
export default function ChatWebScreen() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const web = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const currentUrlRef = useRef('');
  const homeUrlRef = useRef<string | null>(null);
  const setWebCanGoBack = useAppStore((s) => s.setWebCanGoBack);
  const themeMode = useAppStore((s) => s.themeMode);
  const t = useTheme();
  const kind = activeAgentKind();

  // The web UI owns its history and its project-list home. Chrome calls these
  // handlers so Android back, the header back arrow, and the Home menu item
  // never strand the user in a session.
  useEffect(() => {
    setWebBackHandler(() => {
      if (!canGoBackRef.current || !web.current) return false;
      web.current.goBack();
      return true;
    });
    setWebHomeHandler(() => {
      const home = homeUrlRef.current;
      if (!home || !web.current) return false;
      if (currentUrlRef.current === home) return true;
      web.current.injectJavaScript(`window.location.href = ${JSON.stringify(home)}; true;`);
      return true;
    });
    return () => {
      setWebBackHandler(null);
      setWebHomeHandler(null);
      setWebCanGoBack(false);
    };
  }, [setWebCanGoBack]);

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
        const st = useAppStore.getState();
        const requested = st.enginePort;
        let port = requested;
        const res = ensureServeRunning(requested);
        if (res.status === 'unavailable') throw new Error('engine unavailable');
        if (res.port !== requested) {
          port = res.port;
          void st.setEnginePort(res.port);
        }
        const conn = engineConn(port);
        if (res.status !== 'already-running') {
          await waitForEngine(kind, conn);
        }
        const pairUrl = await kind.pairUrl(conn);
        if (!cancelled) {
          // Log the base (never the single-use URL) for diagnostics.
          console.log(`[phonecando] web pair ok base=${engineBaseUrl(port)}`);
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
        <WebView
          ref={web}
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: t.bg }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          injectedJavaScriptBeforeContentLoaded={kind.web.themeScript(themeMode, t)}
          onLoadStart={() => setPageLoading(true)}
          onLoadEnd={() => {
            setPageLoading(false);
            web.current?.injectJavaScript(kind.web.themeScript(themeMode, t));
          }}
          onNavigationStateChange={(nav) => {
            currentUrlRef.current = nav.url;
            if (!homeUrlRef.current && nav.url && !kind.web.isAuthUrl(nav.url)) {
              homeUrlRef.current = nav.url;
            }
            const atHome = homeUrlRef.current === nav.url;
            canGoBackRef.current = nav.canGoBack && !atHome;
            setWebCanGoBack(nav.canGoBack && !atHome);
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
        {pageLoading ? (
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

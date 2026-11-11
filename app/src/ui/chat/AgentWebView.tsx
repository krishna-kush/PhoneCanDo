import { useEffect, useMemo, useRef, useState } from 'react';
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
import { webUiFor } from '../../engine/agents/webAdapter';
import { waitForEngine } from '../../engine/connection';
import { pairWebUi } from '../../engine/engines';
import { isRunnerAvailable } from '../../engine/runner';
import { track } from '../../engine/telemetry';
import AppButton from '../common/AppButton';
import WakingLine from '../common/face/WakingLine';
import LogoLoader from '../common/LogoLoader';
import { useTheme } from '../common/globals';

// One agent's web UI in a WebView, signed in with a fresh one-time pairing
// URL per mount (the runner pairs as the kind's manifest says). HomeScreen mounts one per
// active agent of a web-home kind, so a switch pairs again, lands on the web
// home (projects and sessions live there; no app-side chats) and then
// returns to the page that agent was last on (lastPage.ts). Android Back
// walks the web history and the header menu has a Home action, so a session
// never strands the user; the TUI (`TerminalScreen`) is untouched — the
// header menu switches views. Theme and embed scripts come from the kind's web adapter
// (webAdapter.ts).
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
  const themeMode = useAppStore((s) => s.themeMode);
  const t = useTheme();
  const kind = agentKind(agent.kind);
  // Null for a kind without a web UI: pairing then fails with a message.
  const webUi = useMemo(() => (kind.web ? webUiFor(kind.web.adapter) : null), [kind]);
  useOpenChat(agent.id, chatId);

  // The web UI owns its history and its project-list home. Chrome calls these
  // handlers so Android Back and the Home menu item never strand the user in
  // a session. Back works on every page but the
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
      if (last && webUi && !webUi.isAuthUrl(last)) rememberPage(agent.id, last);
      setWebBackHandler(null);
      setWebHomeHandler(null);
    };
  }, [agent.id, webUi]);

  // The web app stays mounted across app theme changes; re-assert the scheme
  // in place so the session/scroll state survives the switch.
  useEffect(() => {
    if (webUi) web.current?.injectJavaScript(webUi.themeScript(themeMode, t));
  }, [themeMode, t, webUi]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isRunnerAvailable()) throw new Error('native module unavailable');
        if (!webUi) throw new Error(`${kind.label} has no web UI`);
        const agentId = agent.id;
        const res = await useAgentsStore.getState().startAgent(agentId);
        if (res.status === 'unavailable') throw new Error('engine unavailable');
        if (res.port == null) throw new Error(res.error ?? res.status);
        if (res.status !== 'already-running') {
          await waitForEngine(agentId);
        }
        const pairUrl = await pairWebUi(agentId);
        if (!cancelled) {
          // Log the port (never the single-use URL) for diagnostics.
          console.log(`[phonecando] web pair ok port=${res.port}`);
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

  if (url == null || webUi == null) {
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
        <WakingLine />
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
          injectedJavaScriptBeforeContentLoaded={webUi.themeScript(themeMode, t)}
          onLoadEnd={(e) => {
            web.current?.injectJavaScript(webUi.themeScript(themeMode, t));
            const loaded = e.nativeEvent.url;
            if (!webUi.isAuthUrl(loaded)) {
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
            setChatId(webUi.isAuthUrl(nav.url) ? null : webUi.sessionOf(nav.url));
            if (!homeUrlRef.current && nav.url && !webUi.isAuthUrl(nav.url)) {
              homeUrlRef.current = nav.url;
            }
            canGoBackRef.current = nav.canGoBack;
          }}
          injectedJavaScript={webUi.embedScript}
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

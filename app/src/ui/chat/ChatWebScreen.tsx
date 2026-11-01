import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text, YStack } from 'tamagui';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { WebView } from 'react-native-webview';
import { useAppStore, type ThemeMode } from '../../state/app';
import { setWebBackHandler, setWebHomeHandler } from './webNavigation';
import { ensureServeRunning } from '../../engine/ensureServe';
import { engineBaseUrl, isRunnerAvailable } from '../../engine/runner';
import {
  createPairingCode,
  pairingUrl,
  waitForEngine,
} from '../../engine/sessions';
import AppButton from '../common/AppButton';
import LogoLoader from '../common/LogoLoader';
import { useTheme, type Theme } from '../common/globals';

// opencode's web UI reads this key before boot (`oc-theme-preload.js`) and
// listens for storage events after boot. Pass the app's mode so the embedded
// UI follows the shell, including `system`. Its palette is a set of v2 CSS
// variables; override only the shell-facing ones, leaving syntax/state colors
// to opencode.
function themeScript(mode: ThemeMode, theme: Theme) {
  const value = JSON.stringify(mode);
  const vars: Record<string, string> = {
    '--v2-background-bg-base': theme.bg,
    '--v2-background-bg-deep': theme.bg,
    '--v2-background-bg-layer-01': theme.panel,
    '--v2-background-bg-layer-02': theme.panel2,
    '--v2-background-bg-layer-03': theme.panel2,
    '--v2-background-bg-layer-04': theme.panel2,
    '--v2-text-text-base': theme.fg,
    '--v2-text-text-muted': theme.muted,
    '--v2-text-text-faint': theme.dim,
    '--v2-icon-icon-base': theme.muted,
    '--v2-icon-icon-muted': theme.dim,
    '--v2-icon-icon-faint': theme.faint,
    '--v2-border-border-base': theme.line,
    '--v2-border-border-strong': theme.lineStrong,
    '--v2-border-border-muted': theme.line,
    '--v2-background-bg-accent': theme.primary,
    '--v2-text-text-accent': theme.primary,
    '--v2-text-text-accent-hover': theme.primaryHi,
    '--v2-icon-icon-accent': theme.primary,
    '--v2-icon-icon-accent-hover': theme.primaryHi,
    '--v2-border-border-focus': theme.primary,
  };
  const css = JSON.stringify(
    `html:root{background-color:${theme.bg}!important;${Object.entries(vars)
      .map(([key, val]) => `${key}:${val};`)
      .join('')}}`,
  );
  return `(function () {
    try {
      localStorage.setItem('opencode-color-scheme', ${value});
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'opencode-color-scheme',
        newValue: ${value},
        storageArea: localStorage,
      }));
      var style = document.getElementById('phonecando-theme');
      if (!style) {
        style = document.createElement('style');
        style.id = 'phonecando-theme';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = ${css};
    } catch (e) {}
  })();
  true;`;
}

// Default chat view: the v2 web UI in a WebView, authed via a fresh pairing
// code per mount (`POST /api/pair` → `/auth/connect/{code}` sets the cookie).
// Lands on the web home (project/session overview with tappable, named
// projects). Home project selection persists in the page profile. App chrome
// adds a web-history back arrow and an OpenCode home action so a session
// never strands the user; the TUI (`TerminalScreen`) is untouched — the
// header menu switches views.
// Web home: pair-loaded opencode home (projects + sessions live there).
// No app-side chats: the web UI owns sessions end to end.
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
    web.current?.injectJavaScript(themeScript(themeMode, t));
  }, [themeMode, t]);

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
        if (res.status !== 'already-running') {
          await waitForEngine(port);
        }
        const pair = await createPairingCode(port);
        if (!cancelled) {
          // Log the base (never the single-use code) for diagnostics.
          console.log(`[phonecando] web pair ok base=${engineBaseUrl(port)}`);
          setUrl(pairingUrl(port, pair.code));
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
          injectedJavaScriptBeforeContentLoaded={themeScript(themeMode, t)}
          onLoadStart={() => setPageLoading(true)}
          onLoadEnd={() => {
            setPageLoading(false);
            web.current?.injectJavaScript(themeScript(themeMode, t));
          }}
          onNavigationStateChange={(nav) => {
            currentUrlRef.current = nav.url;
            if (!homeUrlRef.current && nav.url && !nav.url.includes('/auth/connect/')) {
              homeUrlRef.current = nav.url;
            }
            const atHome = homeUrlRef.current === nav.url;
            canGoBackRef.current = nav.canGoBack && !atHome;
            setWebCanGoBack(nav.canGoBack && !atHome);
          }}
          // The embedded web shell renders its own titlebar (tab strip chrome)
          // above the content — dead space inside our app, which already has
          // AppHeader. Hide it in-page (persists across SPA navigations;
          // re-injected on every real page load).
          injectedJavaScript={`
            (function () {
              var style = document.getElementById('phonecando-embed');
              if (!style) {
                style = document.createElement('style');
                style.id = 'phonecando-embed';
                style.textContent = '[data-slot="titlebar-v2"]{display:none !important}';
                document.documentElement.appendChild(style);
              }
            })();
            true;
          `}
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

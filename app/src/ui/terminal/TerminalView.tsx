import { useEffect, useMemo, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import { TextInput } from 'react-native';
import { Text, YStack } from 'tamagui';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import ExtraKeysBar from './ExtraKeysBar';
import { usePtySession } from './usePtySession';
import { useMirrorInput } from './useMirrorInput';
import { useInitialInput } from './useInitialInput';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useAppStore } from '../../state/app';
import { useKeyboardStore } from '../../state/keyboard';
import { keyboardRoom } from '../common/keyboard/room';
import { arrowSeq, wheelSeq } from './keys';
import type { PtyEnd, PtyTransport } from './transport/types';
import LogoLoader from '../common/LogoLoader';
import { useTheme } from '../common/globals';
import { useTermTheme, type ThemePageMsg } from './theme/useTermTheme';
import { isTerminalAvailable, TerminalGestureHost } from '../../engine/terminal';

type PageMsg =
  | { type: 'ready'; cols: number; rows: number; pxW: number; pxH: number; cellW?: number; cellH?: number }
  | { type: 'termsize'; cols: number; rows: number; pxW: number; pxH: number; why: string; cellW?: number; cellH?: number }
  | { type: 'tap' }
  /** Steps for the program: wheel reports, or arrow keys (`as: 'arrows'`, `app`: its cursor-key mode). */
  | { type: 'scroll'; dir: number; steps?: number; t?: number; as?: 'arrows'; app?: boolean }
  /** The page's own scrollback left its bottom (or came back). */
  | { type: 'scrolled'; up: boolean }
  | { type: 'input'; data: string }
  | { type: 'title'; title: string }
  | ThemePageMsg;

type Props = {
  /** Makes what the view talks to (transport/): its own PTY, or a TUI
      engine's hosted one. Called once per mount. */
  transport: () => PtyTransport;
  /** On screen. Autofocus and the output pump run only then: TabPager
      keeps every page mounted. */
  active: boolean;
  /** What runs, for the note on builds without the native PTY ('sh', 'tui'). */
  name: string;
  /** Typed in once the program first waits for input, without Enter. */
  initialInput?: string;
  /** The title the program gives its terminal (OSC 0/2). */
  onTitle?: (title: string) => void;
  /** Output stopped for good. */
  onEnd?: (end: PtyEnd) => void;
};

// One terminal: xterm.js in a render-only WebView, a hidden RN input that
// owns the IME and mirrors the program's line, the extra-keys row and the
// live keyboard spacer. What it talks to is the transport; input, sizing
// and rendering are the same for every one.
export default function TerminalView({ transport, active, name, initialInput, onTitle, onEnd }: Props) {
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const webRef = useRef<WebView<object>>(null);

  const available = useMemo(() => isTerminalAvailable(), []);

  const { termSize, error: ptyError, outputSettled, applySize, sendText, reply, boostPump } = usePtySession({
    available,
    htmlUri,
    webRef,
    transport,
    active,
    onEnd,
  });
  // The app's scheme: the page's colours, the views around it, and what
  // the program hears about it (theme/).
  const theme = useTermTheme({ webRef, htmlUri, reply });
  const { look } = theme;
  const primary = useTheme().primary;
  // What the user types goes to the program with the view at the bottom,
  // as in a desktop terminal: a swipe may have scrolled the page's own
  // scrollback up ('scrolled').
  const scrolledUp = useRef(false);
  const typed = (text: string) => {
    if (scrolledUp.current) {
      scrolledUp.current = false;
      webRef.current?.injectJavaScript('window.__toBottom && window.__toBottom();true;');
    }
    sendText(text);
  };
  const {
    inputRef,
    mirror,
    ctrlOn,
    shiftOn,
    toggleCtrl,
    toggleShift,
    pressExtraKey,
    handleFieldChange,
    submitLine,
  } = useMirrorInput({ sendText: typed });
  useInitialInput({
    text: initialInput,
    ready: outputSettled,
    mirror,
    type: handleFieldChange,
  });
  const error = assetError ?? ptyError;

  // Off screen, the keyboard is not ours to hold.
  useEffect(() => {
    if (!active) inputRef.current?.blur();
  }, [active, inputRef]);

  // Keyboard spacer: the room the keyboard takes, every frame on the UI
  // thread, settle included (common/keyboard/room.ts), not the one-shot
  // keyboardDidShow, which understates Gboard. Nothing sits below a
  // terminal (no footer), so the room is the spacer as is. A terminal that
  // mounts with the keyboard up has it at once.
  const keyboardOpen = useKeyboardStore((s) => s.open);
  const extraKeysSticky = useAppStore((s) => s.extraKeysSticky);
  const spacer = useAnimatedStyle(() => ({ height: keyboardRoom.value }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../../assets/xterm/terminal.bundle.html'));
        await asset.downloadAsync();
        if (!cancelled && asset.localUri) setHtmlUri(asset.localUri);
      } catch (e) {
        if (!cancelled) setAssetError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as PageMsg;
      if (theme.onMessage(msg)) return;
      if (msg.type === 'ready') {
        console.log(
          `[phonecando-size] ready cols=${msg.cols} rows=${msg.rows} px=${msg.pxW}x${msg.pxH} cell=${(msg.pxW / msg.cols).toFixed(1)}x${(msg.pxH / msg.rows).toFixed(1)} true=${msg.cellW ?? '?'}x${msg.cellH ?? '?'}`,
        );
        applySize(msg.cols, msg.rows);
        theme.onReady();
        if (active) inputRef.current?.focus();
      } else if (msg.type === 'termsize') {
        console.log(
          `[phonecando-size] termsize(${msg.why}) cols=${msg.cols} rows=${msg.rows} px=${msg.pxW}x${msg.pxH} true=${msg.cellW ?? '?'}x${msg.cellH ?? '?'}`,
        );
        applySize(msg.cols, msg.rows);
      } else if (msg.type === 'title') {
        onTitle?.(msg.title);
      } else if (msg.type === 'tap') {
        // WebView is render-only (disableStdin); taps must focus RN input,
        // unless nothing takes input now (an agent's ended TUI on show).
        if (active) inputRef.current?.focus();
      } else if (msg.type === 'scroll') {
        // Swipe/wheel bridge from the page, for a program that scrolls
        // itself (the page scrolls its own scrollback for the rest): wheel
        // reports, or arrow keys on an alternate screen without them
        // (keys.ts). Neither touches the input line, so the mirror stays
        // intact. Steps arrive batched; one write per message.
        const n = Math.min(Math.max(msg.steps ?? 1, 1), 20);
        sendText(
          msg.as === 'arrows'
            ? arrowSeq(msg.dir, n, msg.app === true)
            : wheelSeq(msg.dir, n, termSize.cols, termSize.rows),
        );
        boostPump(n, msg.t ?? Date.now());
      } else if (msg.type === 'scrolled') {
        scrolledUp.current = msg.up;
      }
      // 'input' from the page is ignored: RN input owns the keyboard.
      // The page runs with disableStdin precisely because WebView IME
      // handling is unreliable on Android (Gboard composition).
    } catch {
      // malformed message
    }
  }

  if (!available) {
    return (
      <YStack flex={1} backgroundColor={look.xterm.background} padding="3" gap="2">
        <Text color={look.xterm.cursor} fontFamily="mono">
          $ {name}
        </Text>
        <Text color={look.muted} fontFamily="mono">
          Native PTY terminal needs a dev build (Expo Go can't load it).
        </Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} backgroundColor={look.xterm.background} padding="3">
        <Text color={primary} fontFamily="mono">
          Terminal error: {error}
        </Text>
      </YStack>
    );
  }

  if (htmlUri == null) {
    return (
      <YStack
        flex={1}
        backgroundColor={look.xterm.background}
        padding="3"
        gap="4"
        alignItems="center"
        justifyContent="center"
      >
        <LogoLoader size={24} />
        <Text color={look.muted} fontFamily="mono">
          Loading terminal…
        </Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={look.panel}>
      {/* No onTouchStart focus here: the page posts 'tap' only for true taps
          (swipes become 'scroll'), so focusing on raw touch-down would summon
          the keyboard while the user is just trying to read back. */}
      <YStack flex={1} backgroundColor={look.xterm.background}>
        {/* Up/down gestures stay with the terminal wherever it is hosted;
            sideways ones go to its parents (engine/terminal.ts). WebView<object>: react-native-webview
            13.16.2 defaults its extra-props type to `undefined`, which leaves
            no prop valid; object types the same on every version. */}
        <TerminalGestureHost style={{ flex: 1 }}>
          <WebView<object>
            ref={webRef}
            source={{ uri: theme.uri ?? htmlUri }}
            style={{ flex: 1, backgroundColor: look.xterm.background }}
            originWhitelist={['*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            javaScriptEnabled
            domStorageEnabled={false}
            onMessage={onMessage}
          />
        </TerminalGestureHost>
      </YStack>
      <ExtraKeysBar
        ctrlOn={ctrlOn}
        shiftOn={shiftOn}
        onToggleCtrl={toggleCtrl}
        onToggleShift={toggleShift}
        onPressKey={pressExtraKey}
        keyboardVisible={keyboardOpen}
        // With the keyboard; Settings → Look & feel keeps them up while reading
        // too (the only way to send scroll keys with the keyboard down).
        visibleWhenKeyboardOpen={!extraKeysSticky}
      />
      {/* The keyboard's room, animated on the UI thread: lifts the row above it. */}
      <Animated.View style={spacer} />
      {/* RN input owns the soft keyboard. It holds a MIRROR of the TUI's
          current line as a real document ("fake input given to Gboard"),
          so composing/glide/mic/autocorrect all work; every change is
          reconciled to terminal keystrokes (see reconcile.ts). Absolute 1x1
          overlay: Android enforces a ~45px min-height on multiline fields,
          so an in-flow "height:1" still eats a full row of layout between
          the terminal and what sits below it. Absolute keeps it mounted+focusable
          (IME commits; never height:0/offscreen) with zero flow footprint. */}
      <TextInput
        ref={inputRef}
        value={mirror}
        autoFocus={active}
        multiline
        submitBehavior="newline"
        onChangeText={handleFieldChange}
        onKeyPress={(e) => {
          // Redundant Enter paths: some keyboards fire keypress/action
          // instead of inserting a newline; submitLine dedupes.
          if (e.nativeEvent.key === 'Enter') submitLine('keypress');
        }}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        // Plain text contract: password variations (tried for strip
        // suppression) cost the mic, glide and predictions on all IMEs.
        // Strip growth is now followed by live keyboard height instead.
        keyboardType="default"
        blurOnSubmit={false}
        onSubmitEditing={() => submitLine('action')}
        returnKeyType="go"
        caretHidden
        style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0 }}
      />
    </YStack>
  );
}

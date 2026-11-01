import { useEffect, useMemo, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import { TextInput } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, YStack } from 'tamagui';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import ExtraKeysBar from './ExtraKeysBar';
import { usePtySession } from './usePtySession';
import { useMirrorInput } from './useMirrorInput';
import { KB_BREATHE, spacerPad } from './sizing';
import { useAppStore } from '../../state/app';
import LogoLoader from '../common/LogoLoader';
import { TUI } from '../common/globals';
import { isTerminalAvailable } from '../../engine/terminal';

type PageMsg =
  | { type: 'ready'; cols: number; rows: number; pxW: number; pxH: number; cellW?: number; cellH?: number }
  | { type: 'termsize'; cols: number; rows: number; pxW: number; pxH: number; why: string; cellW?: number; cellH?: number }
  | { type: 'tap' }
  | { type: 'scroll'; dir: number; steps?: number; t?: number }
  | { type: 'input'; data: string };

function logLiveKb(height: number, pad: number) {
  console.log(`[phonecando-kb] live height=${height} pad=${pad}`);
}

export default function TerminalScreen() {
  const terminalDir = useAppStore((s) => s.terminalDir);
  const enginePort = useAppStore((s) => s.enginePort);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const webRef = useRef<WebView>(null);

  const available = useMemo(() => isTerminalAvailable(), []);

  const { termSize, error: ptyError, applySize, sendText, boostPump } = usePtySession({
    available,
    htmlUri,
    enginePort,
    webRef,
    dir: terminalDir ?? '',
  });
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
  } = useMirrorInput({ sendText });
  const error = assetError ?? ptyError;

  // Keyboard spacer: live native height (every frame incl. settle), not the
  // one-shot keyboardDidShow event — Gboard keeps growing after it (toolbar
  // late-load, suggestion strip) with no follow-up event, and the stale
  // number stranded the accessory bar under the keyboard. e.height is the
  // settled truth on any device/IME. See sizing.ts.
  const [kbHeight, setKbHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const insetBottom = insets.bottom;
  const lastLivePad = useSharedValue(-1);
  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet';
        const pad = spacerPad(e.height, insetBottom, KB_BREATHE);
        if (Math.abs(pad - lastLivePad.value) >= 1) {
          lastLivePad.value = pad;
          runOnJS(setKbHeight)(Math.round(pad));
        }
      },
      onEnd: (e) => {
        'worklet';
        const pad = spacerPad(e.height, insetBottom, KB_BREATHE);
        lastLivePad.value = pad;
        runOnJS(setKbHeight)(Math.round(pad));
        runOnJS(logLiveKb)(Math.round(e.height), Math.round(pad));
      },
    },
    [insetBottom],
  );

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
      if (msg.type === 'ready') {
        console.log(
          `[phonecando-size] ready cols=${msg.cols} rows=${msg.rows} px=${msg.pxW}x${msg.pxH} cell=${(msg.pxW / msg.cols).toFixed(1)}x${(msg.pxH / msg.rows).toFixed(1)} true=${msg.cellW ?? '?'}x${msg.cellH ?? '?'}`,
        );
        applySize(msg.cols, msg.rows);
        inputRef.current?.focus();
      } else if (msg.type === 'termsize') {
        console.log(
          `[phonecando-size] termsize(${msg.why}) cols=${msg.cols} rows=${msg.rows} px=${msg.pxW}x${msg.pxH} true=${msg.cellW ?? '?'}x${msg.cellH ?? '?'}`,
        );
        applySize(msg.cols, msg.rows);
      } else if (msg.type === 'tap') {
        // WebView is render-only (disableStdin); taps must focus RN input.
        inputRef.current?.focus();
      } else if (msg.type === 'scroll') {
        // Swipe/wheel bridge from the page (alt-screen TUI has no xterm
        // scrollback). Synthetic SGR mouse-wheel, not key chords: the TUI's
        // ScrollBox owns the wheel path (velocity acceleration +
        // scroll_speed base), while key line-commands bypass it at 3 lines
        // a press. Center-cell coords land inside the messages viewport.
        // They never touch the input line, so the mirror stays intact.
        // Steps arrive batched; one write per message.
        const n = Math.min(Math.max(msg.steps ?? 1, 1), 20);
        const cx = Math.max(1, Math.floor(termSize.cols / 2));
        const cy = Math.max(1, Math.floor(termSize.rows / 2));
        const wheel =
          String.fromCharCode(27) + (msg.dir < 0 ? '[<64;' : '[<65;') + cx + ';' + cy + 'M';
        sendText(wheel.repeat(n));
        boostPump(n, msg.t ?? Date.now());
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
      <YStack flex={1} backgroundColor={TUI.bg} padding="$3" gap="$2">
        <Text color="#0f0" fontFamily="$mono">
          $ opencode
        </Text>
        <Text color={TUI.fg} fontFamily="$mono">
          Native PTY terminal needs a dev build (Expo Go can't load it).
        </Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} backgroundColor={TUI.bg} padding="$3">
        <Text color={TUI.primary} fontFamily="$mono">
          Terminal error: {error}
        </Text>
      </YStack>
    );
  }

  if (htmlUri == null) {
    return (
      <YStack
        flex={1}
        backgroundColor={TUI.bg}
        padding="$3"
        gap="$4"
        alignItems="center"
        justifyContent="center"
      >
        <LogoLoader size={24} />
        <Text color={TUI.fg} fontFamily="$mono">
          Loading terminal…
        </Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={TUI.panel} paddingBottom={kbHeight}>
      {/* No onTouchStart focus here: the page posts 'tap' only for true taps
          (swipes become 'scroll'), so focusing on raw touch-down would summon
          the keyboard while the user is just trying to read back. */}
      <YStack flex={1} backgroundColor={TUI.bg}>
        <WebView
          ref={webRef}
          source={{ uri: htmlUri }}
          style={{ flex: 1, backgroundColor: TUI.bg }}
          originWhitelist={['*']}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          domStorageEnabled={false}
          onMessage={onMessage}
        />
      </YStack>
      <ExtraKeysBar
        ctrlOn={ctrlOn}
        shiftOn={shiftOn}
        onToggleCtrl={toggleCtrl}
        onToggleShift={toggleShift}
        onPressKey={pressExtraKey}
        keyboardVisible={kbHeight > 0}
        // Scroll keys must work while reading (keyboard closed): the bar is
        // the only input path to the render-only WebView.
        visibleWhenKeyboardOpen={false}
      />
      {/* RN input owns the soft keyboard. It holds a MIRROR of the TUI's
          current line as a real document ("fake input given to Gboard"),
          so composing/glide/mic/autocorrect all work; every change is
          reconciled to terminal keystrokes (see reconcile.ts). Absolute 1x1
          overlay: Android enforces a ~45px min-height on multiline fields,
          so an in-flow "height:1" still eats a full row of layout between
          the terminal and the footer. Absolute keeps it mounted+focusable
          (IME commits; never height:0/offscreen) with zero flow footprint. */}
      <TextInput
        ref={inputRef}
        value={mirror}
        autoFocus
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

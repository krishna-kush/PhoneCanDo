import { Button, XStack } from 'tamagui';
import ArrowIcon, { type ArrowDir } from '../common/ArrowIcon';
import { TUI } from '../common/globals';

// The above-keyboard accessory bar: terminal спецkeys plus sticky Ctrl/Shift
// toggles. Presentational only — all PTY wiring (press/modifiers) lives in
// TerminalScreen, which passes callbacks + latch state down.
export type ExtraKey = { label: string; seq: string; icon?: ArrowDir };

export const EXTRA_KEYS: ExtraKey[] = [
  { label: 'Esc', seq: '\x1b' },
  { label: 'Tab', seq: '\t' },
  // TUI scroll: session.page.up/down. Up/Down walk input history instead,
  // and the alt-screen TUI has no xterm scrollback — swipe alone can't work.
  { label: 'PgUp', seq: '\x1b[5~' },
  { label: 'PgDn', seq: '\x1b[6~' },
  { label: '^C', seq: '\x03' },
  { label: '^D', seq: '\x04' },
  { label: 'Up', seq: '\x1b[A', icon: 'up' },
  { label: 'Down', seq: '\x1b[B', icon: 'down' },
  { label: 'Left', seq: '\x1b[D', icon: 'left' },
  { label: 'Right', seq: '\x1b[C', icon: 'right' },
  // { label: '|', seq: '|' },
  // { label: '~', seq: '~' },
];

type Props = {
  ctrlOn: boolean;
  shiftOn: boolean;
  onToggleCtrl: () => void;
  onToggleShift: () => void;
  onPressKey: (seq: string) => void;
  /** Whether the keyboard is currently up (screen passes kbHeight > 0). */
  keyboardVisible: boolean;
  /**
   * When true (default), the bar only renders while the keyboard is up —
   * it behaves as a keyboard accessory. Set false to always show it
   * (e.g. hardware-keyboard setups where soft-keyboard events never fire).
   */
  visibleWhenKeyboardOpen?: boolean;
};

export default function ExtraKeysBar({
  ctrlOn,
  shiftOn,
  onToggleCtrl,
  onToggleShift,
  onPressKey,
  keyboardVisible,
  visibleWhenKeyboardOpen = true,
}: Props) {
  if (visibleWhenKeyboardOpen && !keyboardVisible) return null;
  return (
    <XStack
      width="100%"
      gap="$1"
      paddingHorizontal="$2"
      paddingVertical="$1"
      flexWrap="wrap"
      borderTopWidth={1}
      borderBottomWidth={1}
      borderColor={TUI.line}
      backgroundColor={TUI.panel}
    >
      {EXTRA_KEYS.map((k) => (
        <Button
          key={k.label}
          minHeight={30}
          minWidth={36}
          borderRadius={0}
          fontSize={12}
          paddingHorizontal="$1"
          accessibilityLabel={k.label}
          onPress={() => onPressKey(k.seq)}
        >
          {k.icon ? <ArrowIcon dir={k.icon} /> : k.label}
        </Button>
      ))}
      <Button
        key="ctrl"
        minHeight={30}
        minWidth={44}
        borderRadius={0}
        fontSize={12}
        paddingHorizontal="$1"
        onPress={onToggleCtrl}
        backgroundColor={ctrlOn ? TUI.primary : undefined}
        color={ctrlOn ? 'white' : undefined}
      >
        Ctrl
      </Button>
      <Button
        key="shift"
        minHeight={30}
        minWidth={44}
        borderRadius={0}
        fontSize={12}
        paddingHorizontal="$1"
        onPress={onToggleShift}
        backgroundColor={shiftOn ? TUI.primary : undefined}
        color={shiftOn ? 'white' : undefined}
      >
        Shift
      </Button>
    </XStack>
  );
}

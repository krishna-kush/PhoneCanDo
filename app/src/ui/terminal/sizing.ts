// Keyboard spacer math: the pad lifts the accessory bar above the
// keyboard. Height is live native e.height (useKeyboardHandler, settled
// truth on any device/IME — NOT the one-shot keyboardDidShow event, which
// understates Gboard); inset is the SafeArea bottom (nav bar, which the
// keyboard covers). BREATHE keeps a finger-width gap so the row never
// touches the keyboard (dp, density-independent).
export const KB_BREATHE = 8;

export function spacerPad(keyboardHeight: number, insetBottom: number, breathe = KB_BREATHE): number {
  'worklet';
  return Math.max(0, keyboardHeight - insetBottom + breathe);
}

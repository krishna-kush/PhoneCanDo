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

// The footer stays put while the keyboard opens over it (the keyboard
// draws over the app, and the web home's KeyboardAvoidingView measures
// what sits below it), so a terminal above the footer leaves room only for
// the part of the keyboard above the footer. The room under the terminal is
// then the larger of the two, and moves with the keyboard without a jump.
// A terminal with no footer below it (the overlay) leaves the keyboard's
// room as is. Runs on the UI thread every frame (a worklet).
export function terminalPad(keyboardRoom: number, footerRoom: number, footerBelow: boolean): number {
  'worklet';
  return footerBelow ? Math.max(0, keyboardRoom - footerRoom) : keyboardRoom;
}

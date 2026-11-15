import { createContext, useContext } from 'react';

// A scrolling Screen's way to its end, for a line that turns up at the
// foot of the page after a tap (why Check now can't start): the page
// scrolls it into view, where it would otherwise sit at the window's bottom
// edge, cut off, until you scroll. Null outside a scrolling Screen.
export const ScreenEndContext = createContext<(() => void) | null>(null);

export function useShowScreenEnd(): (() => void) | null {
  return useContext(ScreenEndContext);
}

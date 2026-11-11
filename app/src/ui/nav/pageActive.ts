import { createContext, useContext } from 'react';

// Whether the page around a component is the one in front (not entering,
// not under another page, not leaving): a terminal holds the keyboard only
// then.
export const PageActiveContext = createContext(true);

export function usePageActive(): boolean {
  return useContext(PageActiveContext);
}

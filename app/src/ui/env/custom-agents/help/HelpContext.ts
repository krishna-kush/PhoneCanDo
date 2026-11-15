import { createContext, useContext } from 'react';
import type { FieldHelp } from '../../logic/customAgentText';

/** How a field opens its help sheet. */
export type HelpView = { open: (label: string, help: FieldHelp) => void };

// The form page provides it; a field's info button reads it, so no field passes it on.
export const HelpContext = createContext<HelpView>({ open: () => {} });

export function useHelpView(): HelpView {
  return useContext(HelpContext);
}

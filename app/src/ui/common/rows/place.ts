import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

// The room a grouped row keeps on each side, the key strip's too.
export const ROW_GUTTER = 16;

// Whether a row sits in a RowGroup. On its own (the drawer's places, a
// page's lone switch) it keeps its slim padding and draws no rule.
export const InRowGroup = createContext(false);

export const useInRowGroup = () => useContext(InRowGroup);

// How far the row around it is pressed (0 up, 1 down), on the UI thread,
// for what moves with a press (a link row's ›). Null outside a row.
export const RowPress = createContext<SharedValue<number> | null>(null);

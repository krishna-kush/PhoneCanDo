import { createContext, type ComponentRef, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

export type SheetList = ComponentRef<typeof ScrollView>;

/** Where a sheet's list (SheetScroll) hands the sheet its scroll view. */
export const ScrollSlot = createContext<RefObject<SheetList | null> | null>(null);

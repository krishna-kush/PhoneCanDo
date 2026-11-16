// The numbered seats of a cap's bench (SeatsPicker.tsx), 1 up to the
// biggest cap offered (or saved), and which of them a cap lets in. Pure
// (zero RN imports).
import { capOptions, type Cap, type CapKind } from '../../logic/caps.ts';

/** The numbered places, 1 up to the biggest cap offered (or saved), with none skipped. */
export function capPlaces(kind: CapKind, current: Cap): number[] {
  const top = Math.max(1, ...capOptions(kind, current).filter((c): c is number => c != null));
  return Array.from({ length: top }, (_, i) => i + 1);
}

/** Whether place `n` is inside the cap: every place is when there is none. */
export function inCap(n: number, cap: Cap): boolean {
  return cap == null || n <= cap;
}

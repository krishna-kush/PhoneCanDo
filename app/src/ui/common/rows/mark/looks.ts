// Which look every on/off mark in the app draws (SquareMark: switch rows,
// choice rows, ticks). Change MARK_LOOK and every one of them follows.
//   grow   the plain square: the red fill grows in (Grow)
//   scan   a barcode a red laser line reprints in red (Scan)
//   wake   A-01 asleep in pencil wakes up red, eyes open (Wake)
//   stamp  a tilted red "ON" stamp presses over a faint "OFF" (StampWord)
export type MarkLook = 'grow' | 'scan' | 'wake' | 'stamp';

export const MARK_LOOK: MarkLook = 'wake';

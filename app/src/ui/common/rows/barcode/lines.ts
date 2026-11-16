// The easter eggs in the key strips' barcodes: each box's barcode is a
// real Code 128 of one of these lines, picked by its title (pick.ts), so
// whoever decodes the faint bars finds a joke where the eye sees a serial.
// Short, since each letter widens the barcode; 13 at most (the check holds
// it).
// After a change, the next Metro start (every build, a release's too)
// rewrites bars.ts; pnpm -C app barcodes does it by hand.
export const BARCODE_LINES = [
  'HI HUMAN',
  'BEEP BOOP',
  'A-01 WAS HERE',
  'TAP A-01',
  'YOU FOUND IT',
  'NOT A BUG',
  'ZZZ',
  'MADE ON PHONE',
  'GO OUTSIDE',
] as const;

export const LINE_MAX = 13;

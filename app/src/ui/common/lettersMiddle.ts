// Where a text's letters sit in its box, from the lines the platform laid
// out (Text's onTextLayout, in the phone's own font and density): a line's
// box has room above its capitals and below its baseline, so its letters'
// middle is lower than the box's. Pure (zero RN imports).

/** What this needs of a laid-out line (React Native's TextLayoutLine; Android adds `baseline`). */
export type LaidLine = { y: number; ascender: number; capHeight: number; baseline?: number };

const baselineOf = (l: LaidLine) => l.baseline ?? l.y + l.ascender;

/** The letters' middle, down from the box's top: halfway from the first line's capital tops to the last line's baseline. Null with no lines. */
export function lettersMiddle(lines: readonly LaidLine[]): number | null {
  if (lines.length === 0) return null;
  const first = lines[0];
  return (baselineOf(first) - first.capHeight + baselineOf(lines[lines.length - 1])) / 2;
}

/** How far something centred beside a text box [height] tall moves down to meet its letters' middle: 0 until both are known. */
export function dropToLetters(lines: readonly LaidLine[], height: number): number {
  const middle = lettersMiddle(lines);
  return middle === null || height <= 0 ? 0 : middle - height / 2;
}

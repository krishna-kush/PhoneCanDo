// Code 128, code set B: a short printable-ASCII string (a URL) as a 1D
// barcode any phone scanner reads. Start B, one symbol per character, the
// mod-103 check symbol, stop. Each symbol is six alternating bar and space
// widths, eleven modules wide (the stop has seven, thirteen). The caller
// leaves the quiet zone, at least ten modules, clear on either side.

// Symbol values 0–106, from the Code 128 spec (ISO/IEC 15417).
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;

/** The bars, left to right, in modules from the first bar. */
export type Bar = { x: number; w: number };

export function code128(text: string): { bars: Bar[]; width: number } {
  const values = Array.from(text, (ch) => {
    const value = ch.charCodeAt(0) - 32;
    if (value < 0 || value > 94) throw new Error(`code128: "${ch}" is not printable ASCII`);
    return value;
  });
  const check = values.reduce((sum, value, i) => sum + value * (i + 1), START_B) % 103;

  const bars: Bar[] = [];
  let x = 0;
  for (const symbol of [START_B, ...values, check, STOP]) {
    Array.from(PATTERNS[symbol], Number).forEach((w, i) => {
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    });
  }
  return { bars, width: x };
}

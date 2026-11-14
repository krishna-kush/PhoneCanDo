// Waits for every face the video sets (style/fonts.css), so the first frame
// is never drawn in a fallback.

const FACES = [
  '400 50px "Instrument Serif"',
  'italic 400 50px "Instrument Serif"',
  '400 50px "Geist Variable"',
  '600 50px "Geist Variable"',
  '500 50px "Geist Mono Variable"',
  '700 50px "Geist Mono Variable"',
];

export async function loadFonts() {
  await Promise.all(FACES.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  const missing = FACES.filter((f) => !document.fonts.check(f));
  if (missing.length) console.error(`fonts not loaded: ${missing.join(', ')}`);
}

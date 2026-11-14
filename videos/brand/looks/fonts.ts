// The site's three faces (web/package.json), from this package's own
// copies: Geist for text, Geist Mono for labels, Instrument Serif for the
// headlines. Latin only; every word in our films is. Loading holds each
// render until all four files are in, so no frame is drawn in a fallback.

import geistMono from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2';
import geist from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2';
import serifItalic from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2';
import serif from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2';
import { continueRender, delayRender } from 'remotion';

export const FONT = {
  sans: "'Geist Variable', system-ui, sans-serif",
  mono: "'Geist Mono Variable', ui-monospace, monospace",
  serif: "'Instrument Serif', Georgia, serif",
} as const;

const FACES: readonly [family: string, url: string, descriptors: FontFaceDescriptors][] = [
  ['Geist Variable', geist, { weight: '100 900', style: 'normal' }],
  ['Geist Mono Variable', geistMono, { weight: '100 900', style: 'normal' }],
  ['Instrument Serif', serif, { weight: '400', style: 'normal' }],
  ['Instrument Serif', serifItalic, { weight: '400', style: 'italic' }],
];

let loading: Promise<void> | null = null;

/** Starts loading the faces, once; safe to call from every film. */
export function loadFonts(): Promise<void> {
  if (loading) return loading;
  const hold = delayRender('Loading the fonts');
  loading = Promise.all(
    FACES.map(async ([family, url, descriptors]) => {
      const face = new FontFace(family, `url('${url}') format('woff2')`, descriptors);
      document.fonts.add(await face.load());
    }),
  ).then(() => continueRender(hold));
  return loading;
}

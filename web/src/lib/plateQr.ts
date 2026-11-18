import { encode } from 'uqr';

// The install plate's QR code as one SVG path. Install.astro draws it at
// build time for the plain download route; on a share link's or a campaign
// link's page its script imports this module (and uqr with it, a chunk plain
// pages never load) to draw the same link the buttons carry. Each run of
// dark modules in a row is one rectangle; the 4-module border is the spec's
// quiet zone.

export type PlateQr = {
  /** Modules per side, border included: the SVG's viewBox. */
  size: number;
  /** The dark modules, in module units. */
  path: string;
};

export function plateQr(text: string): PlateQr {
  const qr = encode(text, { ecc: 'M', border: 4 });
  const path = qr.data
    .map((row, y) => {
      let d = '';
      for (let x = 0; x < row.length; x++) {
        if (!row[x]) continue;
        const start = x;
        while (row[x + 1]) x++;
        const run = x - start + 1;
        d += `M${start} ${y}h${run}v1h-${run}z`;
      }
      return d;
    })
    .join('');
  return { size: qr.size, path };
}

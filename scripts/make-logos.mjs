#!/usr/bin/env node
// Brand logo generator. Reads the canonical colours from theme/tokens.json and
// writes the web favicons + Android launcher/splash assets. No dependencies:
// the mark is two rectangles, so we rasterise them into a minimal PNG encoder.
//
//   node scripts/make-logos.mjs   (or: pnpm logos)

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = [];

// ---------- colours + mark geometry ----------
const tokens = JSON.parse(readFileSync(join(ROOT, 'theme/tokens.json'), 'utf8'));
const logo = JSON.parse(readFileSync(join(ROOT, 'theme/logo.json'), 'utf8'));
const SHADOW_RATIO = logo.shadow.ratio;
const ASSET_MIN_SHADOW = logo.shadow.minAssetPx;

function rgba(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb token, got ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
}

const RED = rgba(tokens.dark.primary);
const YELLOW = rgba(tokens.dark.secondary);
const BG = rgba(tokens.dark.bg);
const WHITE = { r: 255, g: 255, b: 255, a: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

// ---------- PNG encoder ----------
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const name = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
}

function png(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function canvas(size, bg) {
  const buf = Buffer.alloc(size * size * 4);
  if (bg) fill(buf, size, 0, 0, size, size, bg);
  return buf;
}

function fill(buf, size, x, y, w, h, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(size, Math.round(x + w));
  const y1 = Math.min(size, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * size + px) * 4;
      buf[i] = color.r;
      buf[i + 1] = color.g;
      buf[i + 2] = color.b;
      buf[i + 3] = color.a;
    }
  }
}

// The official mark: a square front with a hard right/bottom shadow. Geometry
// comes from theme/logo.json, the same spec the web and app render from.
function mark(size, frontRatio, { bg = null, mono = false } = {}) {
  const buf = canvas(size, bg || TRANSPARENT);
  const front = Math.round(size * frontRatio);
  const off = Math.max(ASSET_MIN_SHADOW, Math.round(front * SHADOW_RATIO));
  const total = front + off;
  const x = Math.round((size - total) / 2);
  const y = x;
  if (mono) {
    fill(buf, size, x, y, total, total, WHITE);
  } else {
    fill(buf, size, x + off, y + off, front, front, YELLOW);
    fill(buf, size, x, y, front, front, RED);
  }
  return png(size, size, buf);
}

function solid(size, color) {
  return png(size, size, canvas(size, color));
}

// ---------- writers ----------
function write(rel, data, size) {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  OUT.push({ rel, size });
}

function markSvg(box, frontRatio) {
  const front = Math.round(box * frontRatio);
  const off = Math.max(ASSET_MIN_SHADOW, Math.round(front * SHADOW_RATIO));
  const pad = (box - front - off) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">
  <rect x="${pad + off}" y="${pad + off}" width="${front}" height="${front}" fill="${tokens.dark.secondary}"/>
  <rect x="${pad}" y="${pad}" width="${front}" height="${front}" fill="${tokens.dark.primary}"/>
</svg>
`;
}

// ---------- generated files ----------
// App assets consumed by app.json.
write('app/assets/icon.png', mark(1024, 0.56, { bg: BG }), 1024);
write('app/assets/android-icon-background.png', solid(1024, BG), 1024);
write('app/assets/android-icon-foreground.png', mark(1024, 0.34), 1024);
write('app/assets/android-icon-monochrome.png', mark(1024, 0.34, { mono: true }), 1024);
write('app/assets/splash-icon.png', mark(1024, 0.36), 1024);
write('app/assets/favicon.png', mark(48, 0.5, { bg: BG }), 48);

// Android resource directories. PNG is valid for every mipmap/drawable; stale
// .webp copies are deleted first so aapt never sees two files for one resource.
const RES = 'app/android/app/src/main/res';
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];
for (const [density] of DENSITIES) {
  const dir = join(ROOT, RES, `mipmap-${density}`);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (/^ic_launcher.*\.webp$/i.test(file)) unlinkSync(join(dir, file));
  }
}
for (const [density, scale] of DENSITIES) {
  const legacy = Math.round(48 * scale);
  const adaptive = Math.round(108 * scale);
  const splash = Math.round(288 * scale);
  const base = `${RES}/mipmap-${density}`;
  write(`${base}/ic_launcher.png`, mark(legacy, 0.5, { bg: BG }), legacy);
  write(`${base}/ic_launcher_round.png`, mark(legacy, 0.5, { bg: BG }), legacy);
  write(`${base}/ic_launcher_background.png`, solid(adaptive, BG), adaptive);
  write(`${base}/ic_launcher_foreground.png`, mark(adaptive, 0.34), adaptive);
  write(`${base}/ic_launcher_monochrome.png`, mark(adaptive, 0.34, { mono: true }), adaptive);
  write(`${RES}/drawable-${density}/splashscreen_logo.png`, mark(splash, 0.36), splash);
}

// Web: inside-page / head / manifest assets.
write('web/public/favicon.svg', markSvg(32, 0.66));
write('web/public/logo.svg', markSvg(256, 0.78));
write('web/public/favicon-16x16.png', mark(16, 0.66), 16);
write('web/public/favicon-32x32.png', mark(32, 0.66), 32);
write('web/public/apple-touch-icon.png', mark(180, 0.5, { bg: BG }), 180);
write('web/public/icon-192.png', mark(192, 0.5, { bg: BG }), 192);
write('web/public/icon-512.png', mark(512, 0.5, { bg: BG }), 512);

const manifest = {
  name: 'PhoneCanDo',
  short_name: 'PhoneCanDo',
  description: 'AI that can use your phone.',
  start_url: '/',
  display: 'standalone',
  background_color: tokens.dark.bg,
  theme_color: tokens.dark.bg,
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};
write('web/public/site.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);

// ---------- self-check ----------
for (const { rel, size } of OUT) {
  const buf = readFileSync(join(ROOT, rel));
  if (rel.endsWith('.png')) {
    if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error(`${rel}: not a PNG`);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w !== size || h !== size) throw new Error(`${rel}: ${w}x${h}, expected ${size}`);
  } else if (rel.endsWith('.svg')) {
    const text = buf.toString('utf8');
    if (!text.includes(tokens.dark.primary) || !text.includes(tokens.dark.secondary)) {
      throw new Error(`${rel}: missing brand colours`);
    }
  } else if (rel.endsWith('.webmanifest')) {
    const parsed = JSON.parse(buf.toString('utf8'));
    if (parsed.icons.length === 0 || parsed.theme_color !== tokens.dark.bg) {
      throw new Error(`${rel}: invalid manifest`);
    }
  }
}

console.log(`logos: ${OUT.length} files from ${tokens.dark.primary} + ${tokens.dark.secondary}`);
for (const { rel } of OUT) console.log(`  ${relative(ROOT, join(ROOT, rel))}`);

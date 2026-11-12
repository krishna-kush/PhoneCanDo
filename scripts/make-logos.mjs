#!/usr/bin/env node
// Brand logo generator. Reads the canonical colours from theme/tokens.json and
// writes the web favicons + the app's icon/splash images. No dependencies:
// the mark is two rectangles, so we rasterise them into a minimal PNG encoder.
//
//   node scripts/make-logos.mjs   (or: pnpm logos)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const LIGHT_RED = rgba(tokens.light.primary);
const LIGHT_YELLOW = rgba(tokens.light.secondary);
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
function mark(size, frontRatio, { bg = null, mono = false, front: frontColor = RED, shadow = YELLOW } = {}) {
  const buf = canvas(size, bg || TRANSPARENT);
  const front = Math.round(size * frontRatio);
  const off = Math.max(ASSET_MIN_SHADOW, Math.round(front * SHADOW_RATIO));
  const total = front + off;
  const x = Math.round((size - total) / 2);
  const y = x;
  if (mono) {
    fill(buf, size, x, y, total, total, WHITE);
  } else {
    fill(buf, size, x + off, y + off, front, front, shadow);
    fill(buf, size, x, y, front, front, frontColor);
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

// The mark in a box of `box` units: front square side, shadow offset, padding.
function markRects(box, frontRatio) {
  const front = Math.round(box * frontRatio);
  const off = Math.max(ASSET_MIN_SHADOW, Math.round(front * SHADOW_RATIO));
  return { front, off, pad: (box - front - off) / 2 };
}

function markSvg(box, frontRatio) {
  const { front, off, pad } = markRects(box, frontRatio);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">
  <rect x="${pad + off}" y="${pad + off}" width="${front}" height="${front}" fill="${tokens.dark.secondary}"/>
  <rect x="${pad}" y="${pad}" width="${front}" height="${front}" fill="${tokens.dark.primary}"/>
</svg>
`;
}

// Android's notification small icon: the system tints it one colour and keeps
// only its alpha, so a shaded shadow reads as nothing. The mark is two square
// outlines instead, the shadow's drawn only where the front doesn't cover it.
// `stroke` is also the padding; `off` is wider than the brand's shadow so a
// gap shows between the two outlines at status-bar size.
function markOutlineVector(box, stroke, off) {
  const front = box - 2 * stroke - off;
  const h = stroke / 2; // strokes are centred on their path
  const f0 = stroke + h;
  const f1 = stroke + front - h;
  const s0 = f0 + off;
  const s1 = f1 + off;
  const edge = stroke + front; // the front's outer edge, where the shadow hides
  const line = `android:strokeColor="#FFFFFF" android:strokeWidth="${stroke}"`;
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/make-logos.mjs (pnpm logos); don't edit. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${box}dp"
    android:height="${box}dp"
    android:viewportWidth="${box}"
    android:viewportHeight="${box}">
  <path ${line} android:pathData="M${edge},${s0}H${s1}V${s1}H${s0}V${edge}"/>
  <path ${line} android:pathData="M${f0},${f0}H${f1}V${f1}H${f0}Z"/>
</vector>
`;
}
// ---------- generated files ----------
// App assets consumed by app.json. Prebuild draws Android's launcher and
// splash resources from these, so app/android/ (its gitignored output) is
// never written here: a second copy there broke the build on duplicate
// resources.
write('app/assets/icon.png', mark(1024, 0.56, { bg: BG }), 1024);
write('app/assets/android-icon-background.png', solid(1024, BG), 1024);
write('app/assets/android-icon-foreground.png', mark(1024, 0.34), 1024);
write('app/assets/android-icon-monochrome.png', mark(1024, 0.34, { mono: true }), 1024);
// The launch splash (app/plugins/withSplash.js): dark and light marks, each
// in its scheme's brand colours. The plugin writes Android's splash drawables
// from these on prebuild.
write('app/assets/splash-icon.png', mark(1024, 0.36), 1024);
write('app/assets/splash-icon-light.png', mark(1024, 0.36, { front: LIGHT_RED, shadow: LIGHT_YELLOW }), 1024);
write('app/assets/favicon.png', mark(48, 0.5, { bg: BG }), 48);
// Every notification's small icon (status bar and shade). The runner module's
// res is source, not prebuild output, so writing it here is safe.
write('app/modules/phonecando-runner/android/src/main/res/drawable/ic_stat_phonecando.xml', markOutlineVector(24, 2, 4));

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
  } else if (rel.endsWith('.xml')) {
    if (!buf.toString('utf8').includes('<vector')) throw new Error(`${rel}: not a vector drawable`);
  } else if (rel.endsWith('.webmanifest')) {
    const parsed = JSON.parse(buf.toString('utf8'));
    if (parsed.icons.length === 0 || parsed.theme_color !== tokens.dark.bg) {
      throw new Error(`${rel}: invalid manifest`);
    }
  }
}

console.log(`logos: ${OUT.length} files from ${tokens.dark.primary} + ${tokens.dark.secondary}`);
for (const { rel } of OUT) console.log(`  ${relative(ROOT, join(ROOT, rel))}`);

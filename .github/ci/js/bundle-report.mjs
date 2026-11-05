#!/usr/bin/env node
// Report on an `expo export --platform android` output dir: proves the bundle
// is real Hermes bytecode (what release APKs embed), every asset metadata.json
// lists exists, and the required asset kinds are there (the terminal page is
// an .html asset, the mono fonts .ttf). Writes sizes and, from the source
// map, the largest packages by original source size to the job summary.
//
//   node .github/ci/js/bundle-report.mjs <export-dir> [--require-ext html,ttf]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bytes, createReport, summary } from './lib.mjs';

const argv = process.argv.slice(2);
const dir = argv[0];
const req = argv.indexOf('--require-ext');
const requireExt = req >= 0 ? (argv[req + 1] || '').split(',').filter(Boolean) : [];
const r = createReport();

if (!dir || !existsSync(join(dir, 'metadata.json'))) {
  r.error(`usage: bundle-report.mjs <export-dir>; no metadata.json in ${dir}`);
  r.finish('bundle');
}

const meta = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8'));
const android = meta.fileMetadata?.android;
if (!android?.bundle) {
  r.error('metadata.json has no android bundle');
  r.finish('bundle');
}

const bundlePath = join(dir, android.bundle);
const size = (p) => (existsSync(p) ? statSync(p).size : 0);
const bundleSize = size(bundlePath);
if (!bundleSize) r.error(`bundle ${android.bundle} is missing or empty`);

// Hermes bytecode files start with this 8-byte magic, then a u32 version.
const HBC_MAGIC = Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f]);
let format = 'plain JS';
if (bundleSize) {
  const head = readFileSync(bundlePath).subarray(0, 12);
  if (head.subarray(0, 8).equals(HBC_MAGIC)) format = `Hermes bytecode v${head.readUInt32LE(8)}`;
  else if (android.bundle.endsWith('.hbc')) r.error(`${android.bundle} is named .hbc but lacks the Hermes magic`);
}

const assets = android.assets || [];
let assetBytes = 0;
const assetRows = assets.map((a) => {
  const n = size(join(dir, a.path));
  if (!n) r.error(`asset ${a.path}.${a.ext} listed in metadata.json is missing or empty`);
  assetBytes += n;
  return `| \`.${a.ext}\` | \`${a.path}\` | ${bytes(n)} |`;
});
for (const ext of requireExt) {
  if (!assets.some((a) => a.ext === ext)) r.error(`no .${ext} asset in the bundle (expected one)`);
}

// Source map: group original sources by npm package (pnpm paths keep the
// real package name after the last node_modules/), app code by top folder.
let top = [];
let sourceCount = 0;
const mapPath = `${bundlePath}.map`;
const mapSize = size(mapPath);
if (mapSize) {
  const map = JSON.parse(readFileSync(mapPath, 'utf8'));
  const groups = new Map();
  sourceCount = map.sources.length;
  map.sources.forEach((src, i) => {
    const len = map.sourcesContent?.[i]?.length ?? 0;
    let key;
    const nm = src.lastIndexOf('node_modules/');
    if (nm >= 0) {
      const parts = src.slice(nm + 'node_modules/'.length).split('/');
      key = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    } else if (src.startsWith('\0') || !src.startsWith('/')) {
      key = '(virtual)';
    } else {
      const parts = src.slice(1).split('/');
      key = `(app) ${parts.length > 1 ? `${parts[0]}/` : parts[0]}`;
    }
    const g = groups.get(key) || { files: 0, len: 0 };
    g.files++;
    g.len += len;
    groups.set(key, g);
  });
  top = [...groups].sort((a, b) => b[1].len - a[1].len).slice(0, 15);
}

summary(
  [
    '### Android JS bundle (`expo export --platform android`)',
    '',
    '| What | Size |',
    '|---|---|',
    `| \`${android.bundle.split('/').pop()}\` (${format}) | **${bytes(bundleSize)}** |`,
    `| source map (${sourceCount} sources) | ${bytes(mapSize)} |`,
    `| ${assets.length} assets | ${bytes(assetBytes)} |`,
    '',
    '<details><summary>Assets</summary>',
    '',
    '| Kind | Path | Size |',
    '|---|---|---|',
    ...assetRows,
    '',
    '</details>',
    '',
    ...(top.length
      ? [
          '<details><summary>Largest packages (original source, before minify/bytecode)</summary>',
          '',
          '| Package | Files | Source |',
          '|---|---|---|',
          ...top.map(([k, g]) => `| \`${k}\` | ${g.files} | ${bytes(g.len)} |`),
          '',
          '</details>',
          '',
        ]
      : []),
  ].join('\n'),
);
r.finish('bundle');

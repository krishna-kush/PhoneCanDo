#!/usr/bin/env node
// Page weight of the built site (web/dist), zero dependencies.
//
// For each page: the HTML plus everything a first load fetches from it:
// stylesheets, scripts (and their static imports), icons, images, posters,
// preloads, the web manifest, url()s in the CSS, and the fonts whose
// unicode-range covers a character on the page (the first src of each
// @font-face, i.e. the woff2). Videos count only when they autoplay or do
// not say preload="none"; the README's recordings are separate media.
// Text types are also measured brotli-compressed, as the host serves them.
//
// Fails when a page's raw first-load weight passes --budget (default 3 MB).
// Warns past --warn (default 1 MB), on any non-media file over 1 MB, and on
// any recording over the README's 3 MB.
//
//   node .github/ci/web/page-weight.mjs [web/dist] [--budget BYTES] [--warn BYTES]

import { readdir, readFile, stat, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, constants } from 'node:zlib';
import { resolvePath } from './serve.mjs';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    budget: { type: 'string', default: String(3 * 1024 * 1024) },
    warn: { type: 'string', default: String(1024 * 1024) },
  },
});
const dist = path.resolve(positionals[0] ?? 'web/dist');
const BUDGET = Number(opts.budget);
const WARN = Number(opts.warn);
const MEDIA = /\.(mp4|webm|mov|m4v)$/i;
const TEXT = /\.(html|css|js|mjs|svg|json|webmanifest|txt|xml)$/i;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const rel = (abs) => '/' + path.relative(dist, abs).split(path.sep).join('/');

const sizeCache = new Map();
async function sizes(file) {
  if (!sizeCache.has(file)) {
    const raw = (await stat(file)).size;
    let br = raw;
    if (TEXT.test(file)) {
      br = brotliCompressSync(await readFile(file), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
    }
    sizeCache.set(file, { raw, br });
  }
  return sizeCache.get(file);
}

const category = (file) => {
  if (/\.html$/i.test(file)) return 'html';
  if (/\.css$/i.test(file)) return 'css';
  if (/\.m?js$/i.test(file)) return 'js';
  if (/\.(woff2?|ttf|otf)$/i.test(file)) return 'fonts';
  if (MEDIA.test(file)) return 'media';
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(file)) return 'images';
  return 'other';
};

// ---------- parsing helpers ----------
const attrsOf = (tag) => {
  const attrs = {};
  for (const a of tag.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[a[1].toLowerCase()] = (a[2] ?? a[3] ?? a[4] ?? '').replace(/&amp;/g, '&');
  }
  return attrs;
};

// Characters a visitor sees: text outside tags, scripts and styles.
const pageChars = (html) => {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+);/gi, (_, e) => String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))))
    .replace(/&[a-z]+;/gi, ' ');
  return new Set([...text].map((c) => c.codePointAt(0)));
};

const parseRange = (range) =>
  range.split(',').map((part) => {
    const r = part.trim().replace(/^u\+/i, '');
    if (r.includes('?')) return [parseInt(r.replace(/\?/g, '0'), 16), parseInt(r.replace(/\?/g, 'f'), 16)];
    const [a, b = a] = r.split('-');
    return [parseInt(a, 16), parseInt(b, 16)];
  });

async function resolveRef(url, basePath) {
  if (!url || /^(data|blob|mailto|tel|javascript):/i.test(url) || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url)) return null;
  const { pathname } = new URL(url, `https://x.invalid${basePath}`);
  return resolvePath(dist, pathname);
}

// Fonts and other url()s a stylesheet pulls in for a page with these chars.
async function cssDeps(css, basePath, chars, add) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const faces = [];
  const rest = stripped.replace(/@font-face\s*{([^}]*)}/g, (_, body) => (faces.push(body), ''));
  for (const face of faces) {
    const range = /unicode-range\s*:\s*([^;]+)/i.exec(face)?.[1];
    if (range && ![...chars].some((c) => parseRange(range).some(([a, b]) => c >= a && c <= b))) continue;
    const first = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(face)?.[1];
    await add(await resolveRef(first, basePath));
  }
  for (const m of rest.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) await add(await resolveRef(m[1], basePath));
  for (const m of rest.matchAll(/@import\s+["']([^"']+)["']/g)) {
    const file = await resolveRef(m[1], basePath);
    if (file && (await add(file))) await cssDeps(await readFile(file, 'utf8'), rel(file), chars, add);
  }
}

async function measure(page) {
  const html = await readFile(page, 'utf8');
  const chars = pageChars(html);
  const base = rel(page).replace(/index\.html$/, '');
  const seen = new Set();
  const add = async (file) => {
    if (!file || seen.has(file)) return false;
    seen.add(file);
    return true;
  };
  await add(page);

  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) await cssDeps(m[1], base, chars, add);
  const body = html.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script$1></script>');
  for (const m of body.matchAll(/<(link|script|img|source|video|audio|iframe|embed|input)\b([^>]*)>/gi)) {
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    if (tag === 'link') {
      if (!/\b(stylesheet|icon|apple-touch-icon|manifest|preload|modulepreload)\b/i.test(a.rel ?? '')) continue;
      const file = await resolveRef(a.href, base);
      if ((await add(file)) && /\bstylesheet\b/i.test(a.rel)) await cssDeps(await readFile(file, 'utf8'), rel(file), chars, add);
      continue;
    }
    if (tag === 'video' || tag === 'audio') {
      await add(await resolveRef(a.poster, base));
      if ('autoplay' in a || a.preload !== 'none') await add(await resolveRef(a.src, base));
      continue;
    }
    await add(await resolveRef(a.src, base));
    for (const part of (a.srcset ?? '').split(',')) await add(await resolveRef(part.trim().split(/\s+/)[0], base));
  }
  // Static imports inside module scripts.
  for (const file of [...seen].filter((f) => /\.m?js$/.test(f))) {
    const js = await readFile(file, 'utf8');
    for (const m of js.matchAll(/(?:^|[;}\s])import\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+)["']/g)) {
      await add(await resolveRef(m[1], rel(file)));
    }
  }

  const totals = { raw: 0, br: 0 };
  const byCat = {};
  for (const file of seen) {
    const s = await sizes(file);
    const c = category(file);
    byCat[c] ??= { raw: 0, br: 0, n: 0 };
    byCat[c].raw += s.raw;
    byCat[c].br += s.br;
    byCat[c].n += 1;
    if (c !== 'media') {
      totals.raw += s.raw;
      totals.br += s.br;
    }
  }
  return { page: rel(page), totals, byCat, files: [...seen].map(rel) };
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const all = await walk(dist);
const results = [];
for (const page of all.filter((f) => f.endsWith('.html')).sort()) results.push(await measure(page));

const warnings = [];
const failures = [];
for (const r of results) {
  if (r.totals.raw > BUDGET) failures.push(`${r.page}: ${kb(r.totals.raw)} first load, budget ${kb(BUDGET)}`);
  else if (r.totals.raw > WARN) warnings.push(`${r.page}: ${kb(r.totals.raw)} first load, over the ${kb(WARN)} warning line`);
}
let distTotal = 0;
for (const f of all) {
  const { size } = await stat(f);
  distTotal += size;
  if (MEDIA.test(f) && size > 3 * 1024 * 1024) warnings.push(`${rel(f)}: ${kb(size)}; web/README.md asks for recordings of 3 MB or less`);
  else if (!MEDIA.test(f) && size > 1024 * 1024) warnings.push(`${rel(f)}: ${kb(size)} in one file`);
}

const CATS = ['html', 'css', 'js', 'fonts', 'images', 'other', 'media'];
let md = `### Page weight · budget ${kb(BUDGET)} per page (first load, raw)\n\n`;
md += `| Page | ${CATS.join(' | ')} | Total raw | Total brotli |\n|---|${CATS.map(() => '---:').join('|')}|---:|---:|\n`;
for (const r of results) {
  const cells = CATS.map((c) => (r.byCat[c] ? `${kb(r.byCat[c].raw)} (${r.byCat[c].n})` : '-'));
  md += `| \`${r.page}\` | ${cells.join(' | ')} | **${kb(r.totals.raw)}** | ${kb(r.totals.br)} |\n`;
}
md += `\nWhole dist: ${kb(distTotal)} in ${all.length} files. Media is listed but not in the totals.\n`;
if (warnings.length) md += `\n**Warnings**\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n`;
if (failures.length) md += `\n**Over budget**\n\n${failures.map((f) => `- ${f}`).join('\n')}\n`;
md += `\n<details><summary>Files per page</summary>\n\n`;
for (const r of results) md += `- \`${r.page}\`: ${r.files.map((f) => `\`${f}\``).join(', ')}\n`;
md += `\n</details>\n`;

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n');
for (const w of warnings) console.log(`::warning title=page weight::${w}`);
for (const f of failures) console.error(`::error title=page weight::${f}`);
if (failures.length) process.exitCode = 1;

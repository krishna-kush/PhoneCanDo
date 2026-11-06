#!/usr/bin/env node
// Internal link check of the built site (web/dist), zero dependencies.
//
// Every href/src/srcset/poster/meta-image URL in every page, every url() and
// @import in the CSS (files and inline <style>), and every icon in the web
// manifest must resolve to a file in dist, the way the host resolves it
// (serve.mjs: x, x.html, x/index.html). #fragments must name an id on the
// target page. Absolute URLs on the site's own origin (canonical, og:*) are
// checked the same way. Also enforced:
//   - no subresource (CSS, JS, font, image, icon, media) from another origin:
//     the site ships no CDN and no external JS (web/README.md)
//   - 404.html uses only root-absolute URLs: the host serves it for ANY
//     missing path, at any depth (tce/hosts/cloudflare/wrangler.jsonc
//     not_found_handling)
//   - index.html and 404.html exist
// Every path on the site's domain is a page: the Worker's routes live on the
// API host (web/src/data/site.ts apiOrigin), so download links are external
// here and check-release.mjs verifies the release asset behind each one.
// Unreferenced files are listed as a notice. External links are listed, not
// fetched (the scheduled external job does that).
//
//   node .github/ci/web/check-links.mjs [web/dist]

import { readdir, readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { resolvePath } from './serve.mjs';

const dist = path.resolve(process.argv[2] ?? 'web/dist');
const REQUIRED = ['index.html', '404.html'];
// Files a browser or crawler asks for by convention, never by a link.
const CONVENTIONAL = new Set(['/404.html', '/robots.txt', '/favicon.ico', '/sitemap.xml', '/sitemap-index.xml']);

const errors = [];
const external = new Map(); // url → Set of pages
const referenced = new Set(['/index.html']);
let checked = 0;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = await walk(dist);
const rel = (abs) => '/' + path.relative(dist, abs).split(path.sep).join('/');
for (const f of REQUIRED) {
  if (!files.includes(path.join(dist, f))) errors.push(`${f}: missing from dist`);
}

// ---------- tiny HTML scanner ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

function scanHtml(html) {
  const styles = [];
  const body = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.replace(/>[\s\S]*<\/script>$/i, '></script>'))
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => (styles.push(css), '<style></style>'));
  const tags = [];
  for (const m of body.matchAll(/<([a-zA-Z][\w:-]*)(\s[^>]*?)?\/?>/g)) {
    const attrs = {};
    for (const a of (m[2] ?? '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    }
    tags.push({ name: m[1].toLowerCase(), attrs });
  }
  return { tags, styles };
}

const idCache = new Map();
async function idsOf(file) {
  if (!idCache.has(file)) {
    const { tags } = scanHtml(await readFile(file, 'utf8'));
    const ids = new Set();
    for (const t of tags) {
      if (t.attrs.id) ids.add(t.attrs.id);
      if (t.name === 'a' && t.attrs.name) ids.add(t.attrs.name);
    }
    idCache.set(file, ids);
  }
  return idCache.get(file);
}

// URL path a dist file is served at.
const servedAt = (abs) => {
  const r = rel(abs);
  if (r.endsWith('/index.html')) return r.slice(0, -'index.html'.length);
  return r;
};

// The site's own origin, from the home page's canonical link.
const indexHtml = await readFile(path.join(dist, 'index.html'), 'utf8').catch(() => '');
const canonical = scanHtml(indexHtml).tags.find((t) => t.name === 'link' && /\bcanonical\b/i.test(t.attrs.rel ?? ''));
const siteOrigin = canonical ? new URL(canonical.attrs.href).origin : null;

/**
 * Check one reference.
 * from: the file it appears in; base: the URL path it resolves against;
 * kind: 'nav' (a link), 'sub' (a subresource the browser fetches) or 'meta'.
 */
async function check(raw, { from, base, kind, what }) {
  const url = raw.trim();
  const where = `${rel(from)} ${what}="${url}"`;
  if (!url || /^(mailto|tel|sms|javascript|data|blob):/i.test(url)) return;
  checked++;
  let target;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) {
    const u = new URL(url, 'https://x.invalid');
    if (u.origin !== siteOrigin) {
      if (kind === 'sub') errors.push(`${where}: subresource from another origin (the site ships no CDN or external assets)`);
      if (!external.has(u.href)) external.set(u.href, new Set());
      external.get(u.href).add(rel(from));
      return;
    }
    target = u;
  } else {
    if (rel(from) === '/404.html' && !url.startsWith('/') && !url.startsWith('#')) {
      errors.push(`${where}: relative URL in 404.html breaks when it is served for a nested missing path; use a root-absolute one`);
    }
    target = new URL(url, `https://x.invalid${base}`);
  }
  const file = target.pathname === base && url.startsWith('#') ? from : await resolvePath(dist, target.pathname);
  if (!file) {
    errors.push(`${where}: no file for ${target.pathname}`);
    return;
  }
  referenced.add(rel(file));
  const frag = target.hash.slice(1);
  if (!frag || frag.toLowerCase() === 'top' || frag.startsWith(':~:') || !file.endsWith('.html')) return;
  let id;
  try {
    id = decodeURIComponent(frag);
  } catch {
    id = frag;
  }
  if (!(await idsOf(file)).has(id)) errors.push(`${where}: no id="${id}" in ${rel(file)}`);
}

async function checkCss(css, ctx) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)) {
    await check(m[1] ?? m[2] ?? m[3] ?? '', { ...ctx, kind: 'sub', what: 'url()' });
  }
  for (const m of stripped.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/g)) {
    await check(m[1] ?? m[2], { ...ctx, kind: 'sub', what: '@import' });
  }
}

const SUB_RELS = /\b(stylesheet|icon|apple-touch-icon|mask-icon|manifest|preload|modulepreload|prefetch)\b/i;
const META_URLS = new Set(['og:image', 'og:image:url', 'og:image:secure_url', 'og:url', 'twitter:image', 'og:video', 'og:audio']);

const pages = files.filter((f) => f.endsWith('.html'));
for (const file of pages) {
  const base = servedAt(file);
  const { tags, styles } = scanHtml(await readFile(file, 'utf8'));
  const ctx = { from: file, base };
  for (const { name, attrs } of tags) {
    const sub = (attr) => attrs[attr] !== undefined && check(attrs[attr], { ...ctx, kind: 'sub', what: `${name}[${attr}]` });
    if ((name === 'a' || name === 'area') && attrs.href !== undefined) {
      await check(attrs.href, { ...ctx, kind: 'nav', what: `${name}[href]` });
    } else if (name === 'link' && attrs.href !== undefined) {
      await check(attrs.href, { ...ctx, kind: SUB_RELS.test(attrs.rel ?? '') ? 'sub' : 'nav', what: `link[rel=${attrs.rel}]` });
    } else if (name === 'meta' && META_URLS.has((attrs.property ?? attrs.name ?? '').toLowerCase()) && attrs.content) {
      await check(attrs.content, { ...ctx, kind: 'meta', what: `meta[${attrs.property ?? attrs.name}]` });
    } else {
      for (const attr of ['src', 'poster', 'data']) await sub(attr);
      if (name === 'use' || name === 'image') {
        await sub('href');
        await sub('xlink:href');
      }
      for (const attr of ['srcset', 'imagesrcset']) {
        if (attrs[attr]) {
          for (const part of attrs[attr].split(',')) {
            const u = part.trim().split(/\s+/)[0];
            if (u) await check(u, { ...ctx, kind: 'sub', what: `${name}[${attr}]` });
          }
        }
      }
      if (attrs.style) await checkCss(attrs.style, ctx);
    }
  }
  for (const css of styles) await checkCss(css, ctx);
}

for (const file of files.filter((f) => f.endsWith('.css'))) {
  await checkCss(await readFile(file, 'utf8'), { from: file, base: rel(file) });
}

for (const file of files.filter((f) => /\.webmanifest$|manifest\.json$/.test(f))) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    errors.push(`${rel(file)}: invalid JSON (${e.message})`);
    continue;
  }
  const ctx = { from: file, base: rel(file), kind: 'sub' };
  for (const icon of manifest.icons ?? []) await check(icon.src ?? '', { ...ctx, what: 'icons[].src' });
  for (const key of ['start_url', 'scope']) if (manifest[key]) await check(manifest[key], { ...ctx, kind: 'nav', what: key });
}

// ---------- report ----------
const orphans = files.map(rel).filter((r) => !referenced.has(r) && !CONVENTIONAL.has(r) && !r.endsWith('.html'));
let md = `### Internal links · ${pages.length} pages, ${checked} references\n\n`;
md += errors.length ? `**${errors.length} broken**\n\n${errors.map((e) => `- ${e}`).join('\n')}\n\n` : 'All internal references resolve; no third-party subresources.\n\n';
if (orphans.length) md += `Not referenced by any page, stylesheet or manifest (notice only): ${orphans.map((o) => `\`${o}\``).join(', ')}\n\n`;
md += `<details><summary>${external.size} external links (not fetched here)</summary>\n\n`;
for (const [u, from] of [...external].sort()) md += `- ${u} (${[...from].join(', ')})\n`;
md += `\n</details>\n`;

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n');
for (const o of orphans) console.log(`::notice title=unreferenced file::${o} is in dist but nothing links to it`);
for (const e of errors) console.error(`::error title=broken link::${e}`);
if (errors.length) process.exitCode = 1;

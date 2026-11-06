#!/usr/bin/env node
// Do the site's download links point at the release that is really out?
//
// The site derives every APK URL from app/app.json's version and pins the
// size and SHA-256 that ./manage release wrote to web/src/data/release.json.
// A page links a download in one of two ways:
//   - directly: a https://github.com/<repo>/releases/download/... URL (the
//     computer commands, which pin the SHA-256)
//   - through the Worker: an href="/dl/lite" or "/dl/full" (the buttons). The
//     Worker (tce/hosts/cloudflare) redirects it to
//     releases/download/v<version>/phonecando-<version>-<channel>-arm64.apk,
//     the same name site.ts builds, so that asset counts as linked.
// This asks the GitHub API for that release and checks, for every linked
// asset:
//   - the release exists, is published (not a draft), and has that asset
//   - the asset's size and sha256 digest equal release.json for its channel
// and that a page with a direct link shows both pinned checksums, a page
// with a /dl/<channel> link shows that channel's, and dist has at least one
// download link of either kind. Read-only; GITHUB_TOKEN (optional) only
// raises the API rate limit.
//
//   node .github/ci/web/check-release.mjs [web/dist]

import { readdir, readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = path.resolve(process.argv[2] ?? path.join(repoRoot, 'web/dist'));
const release = JSON.parse(await readFile(path.join(repoRoot, 'web/src/data/release.json'), 'utf8'));
const app = JSON.parse(await readFile(path.join(repoRoot, 'app/app.json'), 'utf8'));
const version = app.expo.version;
const tag = `v${version}`;
const CHANNELS = ['lite', 'full'];

const errors = [];
const rows = [];

if (release.version !== version) errors.push(`release.json is v${release.version}, app/app.json is v${version}`);

// Every page in dist, nested ones included (privacy/index.html).
async function htmlPages(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await htmlPages(path.join(dir, e.name), rel)));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out.sort();
}

// href values of a page, entity-decoded enough for URLs (&amp;).
function hrefs(html) {
  const out = [];
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    out.push((m[1] ?? m[2] ?? m[3] ?? '').trim().replace(/&amp;/g, '&'));
  }
  return out;
}

const prefix = `https://github.com/${release.repo}/releases/download/`;
// The asset the Worker's /dl/<channel> redirects to (site.ts apkUrl, tce download op).
const assetUrl = (channel) => `${prefix}${tag}/phonecando-${version}-${channel}-arm64.apk`;

// Download links in the built pages: url → { pages, via } where via holds
// 'direct' and/or '/dl/<channel>'.
const links = new Map();
const addLink = (url, page, via) => {
  if (!links.has(url)) links.set(url, { pages: new Set(), via: new Set() });
  links.get(url).pages.add(page);
  links.get(url).via.add(via);
};

for (const page of await htmlPages(dist)) {
  const html = await readFile(path.join(dist, page), 'utf8');
  const direct = [...html.matchAll(/https:\/\/github\.com\/[^"'\s<>]+\/releases\/download\/[^"'\s<>]+/g)].map((m) => m[0]);
  for (const url of direct) addLink(url, page, 'direct');
  if (direct.length) {
    for (const ch of CHANNELS) {
      if (!html.includes(release[ch].sha256)) errors.push(`${page} links a download but does not show the ${ch} SHA-256 from release.json`);
    }
  }
  const routed = new Set();
  for (const href of hrefs(html)) {
    const m = /^\/dl\/([^/?#]*)\/?(?:[?#].*)?$/.exec(href);
    if (!m) continue;
    if (!CHANNELS.includes(m[1])) {
      errors.push(`${page}: href="${href}": the Worker serves /dl/lite and /dl/full only`);
      continue;
    }
    routed.add(m[1]);
  }
  for (const ch of routed) {
    addLink(assetUrl(ch), page, `/dl/${ch}`);
    if (!html.includes(release[ch].sha256)) errors.push(`${page} links /dl/${ch} but does not show the ${ch} SHA-256 from release.json`);
  }
}
if (!links.size) errors.push('no download links in dist: neither releases/download URLs nor /dl/<channel> hrefs');

async function getRelease() {
  const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/repos/${release.repo}/releases/tags/${tag}`;
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 404) return null;
      if (res.ok) return res.json();
      last = new Error(`${url}: HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw last;
}

const published = await getRelease();
if (!published) errors.push(`release ${tag} not found in ${release.repo}`);
else if (published.draft) errors.push(`release ${tag} is still a draft`);

for (const [url, { pages: from, via }] of links) {
  const where = [...from].join(', ');
  if (!url.startsWith(prefix)) {
    errors.push(`${where}: ${url} is not under ${prefix}`);
    continue;
  }
  const [linkTag, name] = url.slice(prefix.length).split('/');
  const channel = /-(lite|full)-/.exec(name)?.[1];
  const row = { name, channel: channel ?? '?', via: [...via].sort().join(', '), size: '-', digest: '-', result: 'ok' };
  rows.push(row);
  const fail = (msg) => {
    row.result = 'FAIL';
    errors.push(`${where}: ${name}: ${msg}`);
  };
  if (linkTag !== tag) fail(`links tag ${linkTag}, app is ${tag}`);
  if (!channel) fail('cannot tell lite from full by the file name');
  if (!published) continue;
  const asset = published.assets?.find((a) => a.name === name);
  if (!asset) {
    fail(`no such asset in release ${tag}`);
    continue;
  }
  row.size = String(asset.size);
  row.digest = asset.digest ?? '(none)';
  if (asset.state !== 'uploaded') fail(`asset state is ${asset.state}`);
  if (!channel) continue;
  if (asset.size !== release[channel].size) fail(`size ${asset.size}, release.json says ${release[channel].size}`);
  if (!asset.digest) console.log(`::warning title=release::${name} has no digest in the API; SHA-256 not compared`);
  else if (asset.digest !== `sha256:${release[channel].sha256}`) fail(`digest ${asset.digest}, release.json says sha256:${release[channel].sha256}`);
}

let md = `### Release links · ${release.repo} ${tag}\n\n`;
md += `| Asset | Channel | Linked as | Size | Digest | Result |\n|---|---|---|---:|---|---|\n`;
for (const r of rows) md += `| \`${r.name}\` | ${r.channel} | ${r.via} | ${r.size} | \`${r.digest}\` | ${r.result} |\n`;
if (errors.length) md += `\n**Problems**\n\n${errors.map((e) => `- ${e}`).join('\n')}\n`;
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n');
for (const e of errors) console.error(`::error title=release links::${e}`);
if (errors.length) process.exitCode = 1;

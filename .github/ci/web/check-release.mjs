#!/usr/bin/env node
// Do the site's download buttons point at the release that is really out?
//
// The site derives every APK URL from app/app.json's version and pins the
// size and SHA-256 that ./manage release wrote to web/src/data/release.json.
// This asks the GitHub API for that release and checks, for every
// releases/download link in the built pages:
//   - the release exists, is published (not a draft), and has that asset
//   - the asset's size and sha256 digest equal release.json for its channel
// and that each page with a download shows both pinned checksums. Read-only;
// GITHUB_TOKEN (optional) only raises the API rate limit.
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

const errors = [];
const rows = [];

if (release.version !== version) errors.push(`release.json is v${release.version}, app/app.json is v${version}`);

// Download links in the built pages, and which pages carry them.
const pages = (await readdir(dist)).filter((f) => f.endsWith('.html'));
const prefix = `https://github.com/${release.repo}/releases/download/`;
const links = new Map(); // url → pages
for (const page of pages) {
  const html = await readFile(path.join(dist, page), 'utf8');
  const found = [...html.matchAll(/https:\/\/github\.com\/[^"'\s<>]+\/releases\/download\/[^"'\s<>]+/g)].map((m) => m[0]);
  for (const url of found) {
    if (!links.has(url)) links.set(url, new Set());
    links.get(url).add(page);
  }
  if (found.length) {
    for (const ch of ['lite', 'full']) {
      if (!html.includes(release[ch].sha256)) errors.push(`${page} links a download but does not show the ${ch} SHA-256 from release.json`);
    }
  }
}
if (!links.size) errors.push('no releases/download links found in dist');

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

for (const [url, from] of links) {
  const where = [...from].join(', ');
  if (!url.startsWith(prefix)) {
    errors.push(`${where}: ${url} is not under ${prefix}`);
    continue;
  }
  const [linkTag, name] = url.slice(prefix.length).split('/');
  const channel = /-(lite|full)-/.exec(name)?.[1];
  const row = { name, channel: channel ?? '?', size: '-', digest: '-', result: 'ok' };
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
md += `| Asset | Channel | Size | Digest | Result |\n|---|---|---:|---|---|\n`;
for (const r of rows) md += `| \`${r.name}\` | ${r.channel} | ${r.size} | \`${r.digest}\` | ${r.result} |\n`;
if (errors.length) md += `\n**Problems**\n\n${errors.map((e) => `- ${e}`).join('\n')}\n`;
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n');
for (const e of errors) console.error(`::error title=release links::${e}`);
if (errors.length) process.exitCode = 1;

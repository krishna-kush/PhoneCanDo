#!/usr/bin/env node
// Size report for a static build dir (the site's web/dist): page list, bytes
// per file type (raw and gzip, what a visitor downloads for text), and the
// largest files, written to the job summary. Fails only when the dir has no
// HTML page at all, which means the build produced nothing servable.
//
//   node .github/ci/js/dist-report.mjs <dir> [--title "Website build"]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { bytes, createReport, summary } from './lib.mjs';

const argv = process.argv.slice(2);
const dir = argv[0];
const t = argv.indexOf('--title');
const title = t >= 0 ? argv[t + 1] : `Build output (${dir})`;
const r = createReport();

if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
  r.error(`usage: dist-report.mjs <dir>; ${dir} is not a directory`);
  r.finish('dist');
}

const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml', '.webmanifest']);
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const full = join(d, e.name);
    if (e.isDirectory()) walk(full);
    else {
      const ext = extname(e.name).toLowerCase() || '(none)';
      const buf = readFileSync(full);
      files.push({
        rel: relative(dir, full).split(sep).join('/'),
        ext,
        size: buf.length,
        gz: TEXT.has(ext) ? gzipSync(buf, { level: 9 }).length : null,
      });
    }
  }
})(dir);

const pages = files.filter((f) => f.ext === '.html').sort((a, b) => a.rel.localeCompare(b.rel));
if (!pages.length) r.error(`no .html page in ${dir}`);

const byExt = new Map();
for (const f of files) {
  const g = byExt.get(f.ext) || { n: 0, size: 0, gz: 0, text: f.gz !== null };
  g.n++;
  g.size += f.size;
  g.gz += f.gz ?? 0;
  byExt.set(f.ext, g);
}
const total = files.reduce((s, f) => s + f.size, 0);

summary(
  [
    `### ${title}`,
    '',
    `**${pages.length} page(s)**, ${files.length} files, ${bytes(total)} total.`,
    '',
    '| Page | Size | gzip |',
    '|---|---|---|',
    ...pages.map((p) => `| \`${p.rel}\` | ${bytes(p.size)} | ${bytes(p.gz)} |`),
    '',
    '| Type | Files | Size | gzip |',
    '|---|---|---|---|',
    ...[...byExt]
      .sort((a, b) => b[1].size - a[1].size)
      .map(([ext, g]) => `| \`${ext}\` | ${g.n} | ${bytes(g.size)} | ${g.text ? bytes(g.gz) : '–'} |`),
    '',
    '<details><summary>Largest files</summary>',
    '',
    '| File | Size |',
    '|---|---|',
    ...files
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map((f) => `| \`${f.rel}\` | ${bytes(f.size)} |`),
    '',
    '</details>',
    '',
  ].join('\n'),
);
r.finish('dist');

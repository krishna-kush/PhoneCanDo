#!/usr/bin/env node
// Lighthouse CI results → step summary, zero dependencies.
//
// Reads what `lhci upload --target=filesystem --outputDir=<dir>` wrote
// (manifest.json + the representative run's JSON per URL), plus
// .lighthouseci/assertion-results.json and, when the temporary public
// storage upload ran, .lighthouseci/links.json.
//
//   node .github/ci/web/lhci-summary.mjs <report-dir> <label>

import { readFile, appendFile } from 'node:fs/promises';

const [dir = 'lhci-report', label = 'lighthouse'] = process.argv.slice(2);
const readJson = async (p, fallback) => {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
};

const manifest = await readJson(`${dir}/manifest.json`, []);
const assertions = await readJson('.lighthouseci/assertion-results.json', []);
const links = await readJson('.lighthouseci/links.json', {});

const pct = (v) => (typeof v === 'number' ? String(Math.round(v * 100)) : '-');
const ms = (v) => (typeof v === 'number' ? `${Math.round(v)} ms` : '-');
const pathOf = (u) => new URL(u).pathname;

let md = `### Lighthouse · ${label}\n\n`;
md += `| Page | Perf | A11y | Best pr. | SEO | FCP | LCP | TBT | CLS | Bytes | Report |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|\n`;
for (const e of manifest.filter((m) => m.isRepresentativeRun)) {
  const lhr = await readJson(e.jsonPath, { audits: {} });
  const a = (id) => lhr.audits[id]?.numericValue;
  const s = e.summary;
  const link = links[e.url] ? `[open](${links[e.url]})` : 'artifact';
  const cls = a('cumulative-layout-shift');
  const bytes = a('total-byte-weight');
  md += `| \`${pathOf(e.url)}\` | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s['best-practices'])} | ${pct(s.seo)} | ${ms(a('first-contentful-paint'))} | ${ms(a('largest-contentful-paint'))} | ${ms(a('total-blocking-time'))} | ${typeof cls === 'number' ? cls.toFixed(3) : '-'} | ${typeof bytes === 'number' ? `${(bytes / 1024).toFixed(0)} KB` : '-'} | ${link} |\n`;
}
if (!manifest.length) md += `| (no results: did collect run?) | | | | | | | | | | |\n`;

const failed = assertions.filter((r) => r.passed === false);
if (failed.length) {
  md += `\n**Assertions not met** (warn = reported, error = fails the job)\n\n`;
  md += `| Level | Page | Assertion | Actual | Expected |\n|---|---|---|---|---|\n`;
  for (const r of failed) {
    const actual = typeof r.actual === 'number' ? +r.actual.toFixed(3) : r.actual;
    md += `| ${r.level} | \`${pathOf(r.url)}\` | ${r.auditId ?? r.assertionKey ?? '?'}${r.name && r.name !== 'minScore' ? ` (${r.name})` : ''} | ${actual} | ${r.operator ?? ''} ${r.expected} |\n`;
  }
} else if (manifest.length) {
  // lhci saves only the assertions that did not pass.
  md += `\nAll assertions met.\n`;
}

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n');

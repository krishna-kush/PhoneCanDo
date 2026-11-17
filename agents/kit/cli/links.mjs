#!/usr/bin/env node
// Checks that every official link the app's Choose agent step opens (each
// kind's about.links) is still there:
//   node agents/kit/cli/links.mjs [--root <repo>]
// A link is fine when its site answers with a page (2xx after redirects),
// or when it answers but keeps robots out (401, 403, 429: a sign-in page
// such as an API-key page). It is broken on 404 or 410, or when its host
// no longer exists; those fail the run. A server error or a timeout is
// tried again once and, if it lasts, only warned about, since it says
// nothing about the link itself. Prints a line per link, and a table in the
// GitHub step summary when there is one.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadManifests, REPO_ROOT } from './manifests.mjs';

const TIMEOUT_MS = 20_000;
/** Links checked at once: a few, to be gentle with the sites. */
const AT_ONCE = 4;
/** A browser's user agent: some sites turn plain scripts away before they look at the path. */
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** Every about.links address, with its kind and which link it is, in manifest order. */
export function linksOf(entries) {
  return entries.flatMap(({ id, manifest }) =>
    Object.entries(manifest.about?.links ?? {}).map(([name, url]) => ({ id, name, url })),
  );
}

/**
 * What an answer says about a link: ok (a page), gated (the site answered
 * but keeps robots out), broken (gone, or its host is), or flaky (a server
 * error or no answer: try again later). [answer] is a status code or a
 * fetch error.
 */
export function classify(answer) {
  if (typeof answer === 'number') {
    if (answer >= 200 && answer < 400) return 'ok';
    if (answer === 401 || answer === 403 || answer === 429) return 'gated';
    if (answer === 404 || answer === 410) return 'broken';
    return answer >= 500 ? 'flaky' : 'broken';
  }
  const code = answer?.cause?.code;
  return code === 'ENOTFOUND' || code === 'ERR_INVALID_URL' ? 'broken' : 'flaky';
}

/** What a run ends with: 1 when any link is broken. */
export function exitCode(results) {
  return results.some((r) => r.verdict === 'broken') ? 1 : 0;
}

async function ask(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res.status;
  } catch (e) {
    return e;
  }
}

async function check(link) {
  let answer = await ask(link.url);
  if (classify(answer) === 'flaky') answer = await ask(link.url);
  const said = typeof answer === 'number' ? String(answer) : (answer?.cause?.code ?? answer?.name ?? 'error');
  return { ...link, said, verdict: classify(answer) };
}

async function checkAll(links) {
  const results = new Array(links.length);
  let next = 0;
  const worker = async () => {
    while (next < links.length) {
      const i = next++;
      results[i] = await check(links[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, links.length) }, worker));
  return results;
}

function summary(results) {
  const rows = results.map((r) => `| ${r.id} | ${r.name} | ${r.url} | ${r.said} | ${r.verdict} |`);
  return ['### Agent links (about.links)', '', '| Kind | Link | URL | Answer | Verdict |', '|---|---|---|---|---|', ...rows, ''].join('\n');
}

export async function main(argv, { log = console.log } = {}) {
  const at = argv.indexOf('--root');
  const root = at >= 0 ? resolve(argv[at + 1]) : REPO_ROOT;
  const results = await checkAll(linksOf(loadManifests({ root })));
  for (const r of results) log(`${r.verdict.padEnd(6)} ${r.said.padEnd(9)} ${r.id} ${r.name} ${r.url}`);
  const broken = results.filter((r) => r.verdict === 'broken').length;
  const flaky = results.filter((r) => r.verdict === 'flaky').length;
  log(`links: ${results.length} checked, ${broken} broken, ${flaky} not answering`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(results));
  return exitCode(results);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}

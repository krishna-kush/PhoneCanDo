#!/usr/bin/env node
// Sign-off gate for pull requests from forks: every commit carries a
// Signed-off-by line (git commit -s), the contributor's record that they
// agree to section 7 of LICENSE. Pushes, our own branches and bots are not
// contributions, so anything but a pull request from a fork passes at once.
//
//   EVENT=pull_request BASE_REPO=<owner/repo> HEAD_REPO=<fork owner/repo> \
//   BASE_SHA=<sha> HEAD_SHA=<sha> node .github/ci/js/check-signoff.mjs
import { spawnSync } from 'node:child_process';
import { ROOT, createReport } from './lib.mjs';
import { parseLog, unsigned } from './signoff/rules.mjs';

const { EVENT, BASE_REPO, HEAD_REPO, BASE_SHA, HEAD_SHA } = process.env;

if (EVENT !== 'pull_request' || !HEAD_REPO || HEAD_REPO === BASE_REPO) {
  console.log('Not a pull request from a fork: nothing to sign off.');
  process.exit(0);
}

const r = createReport();
const log = spawnSync(
  'git',
  ['log', '--no-merges', '--format=%H%x1f%an%x1f%ae%x1f%B%x1e', `${BASE_SHA}..${HEAD_SHA}`],
  { cwd: ROOT, encoding: 'utf8' },
);
if (log.status !== 0) {
  r.error(`git log ${BASE_SHA}..${HEAD_SHA} failed: ${log.stderr.trim()}`);
  r.finish('Sign-off');
}

const commits = parseLog(log.stdout);
for (const commit of unsigned(commits)) {
  r.error(
    `${commit.sha.slice(0, 12)} (${commit.name}) has no Signed-off-by line. Sign off every ` +
      `commit to agree to section 7 of LICENSE: git commit -s, or for commits already made, ` +
      `git rebase --signoff ${BASE_SHA.slice(0, 12)} and force-push.`,
  );
}
r.finish(`Sign-off, ${commits.length} commit(s)`);

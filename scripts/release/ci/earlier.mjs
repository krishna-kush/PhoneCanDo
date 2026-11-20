// A workflow whose path filters skipped the release commit still counts:
// its last run on the same branch, on a commit the release contains, decides
// for it. So a red lre-ok two commits back blocks a release whose last commit
// only touched web/. The judging is classify.mjs's own, on that earlier
// commit's checks; GitHub is read through the gh object given (io/gh.mjs or
// a fake), so the tests run it on fakes.

import { classifyChecks, GATE_ROLES, tally, unfinished } from './classify.mjs';

const short = (sha) => sha.slice(0, 7);
const listed = (rows) => rows.map((row) => `${row.name} ${row.state}`).join(', ');

/**
 * (gh, repo) -> lookBack(sha, raw, ci): `ci` (classifyChecks of `raw`, the
 * commit's ciState) with each workflow that did not run on `sha` judged by
 * its last earlier run. Make one per release: it keeps every finished
 * verdict, so the CI wait's polls ask GitHub again only about runs still
 * going.
 */
export function makeLookBack(gh, repo) {
  const settled = new Map(); // workflow file -> its row, once final
  const contained = new Map(); // `${older}\0${sha}` -> sha contains older
  const contains = (older, sha) => {
    const key = `${older}\0${sha}`;
    if (!contained.has(key)) contained.set(key, gh.contains(repo, older, sha));
    return contained.get(key);
  };

  return (sha, raw, ci) => {
    const skipped = ci.rows.filter((row) => row.state === 'not run' && row.decision === 'warn' && row.file);
    const branch = releaseBranch(raw.workflowRuns);
    if (!skipped.length || !branch) return ci;
    const checks = new Map(); // earlier commit -> its classified checks, this poll
    const swapped = new Map();
    for (const row of skipped) {
      if (!settled.has(row.file)) {
        const run = gh.branchRuns(repo, row.file, branch).find((r) => contains(r.head_sha, sha));
        if (!run) {
          settled.set(row.file, { ...row, note: `did not run here, nor before on ${branch}` });
        } else {
          if (!checks.has(run.head_sha)) checks.set(run.head_sha, classifyChecks(gh.ciState(repo, run.head_sha)));
          const theirs = checks.get(run.head_sha).rows.filter((r) => r.file === row.file);
          const judged = judge(row, theirs, run.head_sha);
          if (!unfinished(judged)) settled.set(row.file, judged);
          swapped.set(row, judged);
          continue;
        }
      }
      swapped.set(row, settled.get(row.file));
    }
    return tally(ci.rows.map((row) => swapped.get(row) ?? row));
  };
}

/** The branch the commit was pushed to: its push runs' branch, or null. */
export function releaseBranch(workflowRuns) {
  return workflowRuns.find((run) => run.event === 'push' && run.branch)?.branch ?? null;
}

// The skipped workflow's row, carrying what its rows on the earlier commit
// say: any block blocks (a run still going too, which the CI wait waits on),
// a gate that only warned warns, all green is ok.
function judge(row, theirs, earlier) {
  const at = short(earlier);
  const blocks = theirs.filter((r) => r.decision === 'block');
  if (blocks.length) {
    return { ...row, state: blocks[0].state, decision: 'block', note: `did not run here; its last run, on ${at}: ${listed(blocks)}` };
  }
  const warned = theirs.filter((r) => r.decision === 'warn' && GATE_ROLES.has(r.role));
  if (warned.length) {
    return { ...row, state: warned[0].state, decision: 'warn', note: `did not run here; its last run, on ${at}: ${listed(warned)}` };
  }
  return { ...row, state: 'success', decision: 'ok', note: `did not run here; green on ${at}, its last run` };
}

// Read-only GitHub API calls for the release preflight (GET only, through
// `gh api`): does GitHub have the commit, what ran on it, and the run and
// release the locked Linux image came from. Every list is read to its last
// page; only the fields the decision modules read are kept.
import { failure, spawnRunner } from './spawn.mjs';

const CHECK_RUN = '.check_runs[] | {id, name, status, conclusion, suite: .check_suite.id, app: .app.slug}';
const WORKFLOW_RUN = '.workflow_runs[] | {id, name, path, event, status, conclusion, check_suite_id, created_at}';
const STATUS = '.statuses[] | {context, state}';
const RUN = '{path, status, conclusion, branch: .head_branch, url: .html_url}';
const RELEASE = '{draft, prerelease, assets: [.assets[] | {name, size}]}';

/**
 * { commitState(repo, sha), ciState(repo, sha), runState(repo, id),
 *   releaseState(repo, tag) } over `run` (default: the gh CLI).
 */
export function makeGh({ run = spawnRunner('gh') } = {}) {
  const api = (path, jq) => run(['api', '--paginate', path, '--jq', jq]);
  const list = (path, jq) => {
    const result = api(path, jq);
    if (result.error || result.status !== 0) throw new Error(`gh api ${path}: ${failure(result)}`);
    return result.stdout.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  };
  // One object, or 'missing' when GitHub answers 404; anything else throws.
  const one = (path, jq) => {
    const result = api(path, jq);
    if (!result.error && result.status === 0) return JSON.parse(result.stdout);
    if (!result.error && /\(HTTP 404\)/.test(result.stderr || '')) return 'missing';
    throw new Error(`gh api ${path}: ${failure(result)}`);
  };
  return {
    /**
     * 'present', or 'missing' when GitHub answers 404/422 (it has no such
     * commit: not pushed). Anything else (network, auth) throws: a state
     * that cannot be read is not a go-ahead.
     */
    commitState(repo, sha) {
      const result = api(`repos/${repo}/commits/${sha}`, '.sha');
      if (!result.error && result.status === 0 && result.stdout.trim() === sha) return 'present';
      if (!result.error && /\(HTTP (404|422)\)/.test(result.stderr || '')) return 'missing';
      throw new Error(`gh api repos/${repo}/commits/${sha}: ${failure(result)}`);
    },
    /** { checkRuns, workflowRuns, statuses } for the commit. */
    ciState(repo, sha) {
      return {
        checkRuns: list(`repos/${repo}/commits/${sha}/check-runs?per_page=100`, CHECK_RUN),
        workflowRuns: list(`repos/${repo}/actions/runs?head_sha=${sha}&per_page=100`, WORKFLOW_RUN),
        statuses: list(`repos/${repo}/commits/${sha}/status?per_page=100`, STATUS),
      };
    },
    /** Workflow run `id`: { path, status, conclusion, branch, url }, or 'missing'. */
    runState(repo, id) {
      return one(`repos/${repo}/actions/runs/${id}`, RUN);
    },
    /**
     * The published release tagged `tag`: { draft, prerelease, assets:
     * [{ name, size }] }, or 'missing' (GitHub serves no draft by tag).
     */
    releaseState(repo, tag) {
      return one(`repos/${repo}/releases/tags/${tag}`, RELEASE);
    },
    /**
     * How `commit` stands against the default branch of `repo` (an upstream
     * we build from): { branch, newer: commits on the branch after it,
     * offBranch: commits of it the branch lacks }. Throws when GitHub can't
     * be read. Unpaginated: the counts are whole on the first page.
     */
    upstreamLag(repo, commit) {
      const { branch } = one(`repos/${repo}`, '{branch: .default_branch}');
      const path = `repos/${repo}/compare/${commit}...${branch}`;
      const result = run(['api', path, '--jq', '{newer: .ahead_by, offBranch: .behind_by}']);
      if (result.error || result.status !== 0) throw new Error(`gh api ${path}: ${failure(result)}`);
      return { branch, ...JSON.parse(result.stdout) };
    },
  };
}

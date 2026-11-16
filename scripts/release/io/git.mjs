// Read-only git for the release preflight: the commit HEAD names, the
// porcelain status listing and the files changed since an older commit.
// Nothing here writes to the repo; status runs with --no-optional-locks so
// it does not even refresh the index.
import { failure, spawnRunner } from './spawn.mjs';

/** { head(), porcelain() } over `run` (default: git in `cwd`). */
export function makeGit({ cwd, run = spawnRunner('git', { cwd }) } = {}) {
  const git = (args) => {
    const result = run(args);
    if (result.error || result.status !== 0) throw new Error(`git ${args.join(' ')}: ${failure(result)}`);
    return result.stdout;
  };
  return {
    /** The full commit id HEAD points at. */
    head() {
      const sha = git(['rev-parse', '--verify', 'HEAD']).trim();
      if (!/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)) throw new Error(`git rev-parse HEAD: unexpected output ${sha}`);
      return sha;
    },
    /** `status --porcelain=v1 -z`, untracked files listed one by one (worktree.mjs parses it). */
    porcelain() {
      return git(['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all']);
    },
    /**
     * The files changed from `from` to `to`: { state: 'ok', files }, or
     * { state: 'missing' } when this clone lacks `from` (a shallow CI
     * checkout, or history rewritten since) and { state: 'diverged' } when
     * `from` is not behind `to`.
     */
    changedSince(from, to) {
      if (run(['cat-file', '-e', `${from}^{commit}`]).status !== 0) return { state: 'missing' };
      const behind = run(['merge-base', '--is-ancestor', from, to]);
      if (behind.status === 1) return { state: 'diverged' };
      if (behind.error || behind.status !== 0) throw new Error(`git merge-base --is-ancestor: ${failure(behind)}`);
      const files = git(['diff', '--name-only', '-z', from, to]).split('\0').filter(Boolean);
      return { state: 'ok', files };
    },
  };
}

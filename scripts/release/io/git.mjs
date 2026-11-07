// Read-only git for the release preflight: the commit HEAD names and the
// porcelain status listing. Nothing here writes to the repo; status runs
// with --no-optional-locks so it does not even refresh the index.
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
  };
}

// Packs proot's GPL source tarball with lre/proot/source-tarball.sh, and
// says whether the pinned downloads it reads are cached (then the pack
// needs no network). `run` is injectable: tests never start bash or curl.
import { join } from 'node:path';
import { sourceDownloads } from '../linux/source.mjs';
import { digest } from './linux.mjs';
import { failure, spawnRunner } from './spawn.mjs';

const SCRIPT = 'lre/proot/source-tarball.sh';

/** { missingDownloads(workdir, pins), pack(workdir, out) } in the repo at `root`. */
export function makeProotSource({ root, run = spawnRunner('bash', { cwd: root }) }) {
  return {
    /** Names of the pinned downloads not cached and verified in <workdir>/downloads. */
    missingDownloads(workdir, pins) {
      return sourceDownloads(pins)
        .filter(({ name, sha256 }) => digest(join(workdir, 'downloads', name))?.sha256 !== sha256)
        .map(({ name }) => name);
    },
    /** Packs into `out`; fetches the pinned downloads into <workdir>/downloads first when missing. Returns the script's report. */
    pack(workdir, out) {
      const result = run([join(root, SCRIPT), workdir, out]);
      if (result.error || result.status !== 0) throw new Error(`${SCRIPT}: ${failure(result)}`);
      return result.stdout;
    },
  };
}

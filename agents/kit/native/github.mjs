// GitHub's builds of a native kind's payload (agent-payload.yml). Each build
// uploads <prefix>-payload-arm64 (the libs and their stamp) and a marker
// artifact <prefix>-payload-inputs-<INPUTS>, so the builds of exactly this
// tree's sources are found by name, before anything is downloaded. Both are
// kept 14 days. Read-only: gh api GETs and gh run download.
import { spawnSync } from 'node:child_process';

/** The payload artifact's name (android.yml fetches it by this name too). */
export const artifactName = (manifest) => `${manifest.prefix}-payload-arm64`;
/** The marker artifact a build of `digest` uploads next to it. */
export const markerName = (manifest, digest) => `${manifest.prefix}-payload-inputs-${digest}`;

const ghRunner = (args) => spawnSync('gh', args, { encoding: 'utf8' });

/** { builds(manifest, digest), download(build, manifest, dir) } on `repo` (owner/name). */
export function makeGithub({ repo, run = ghRunner }) {
  const api = (path) => {
    const result = run(['api', path]);
    if (result.error) throw new Error(`gh: ${result.error.code === 'ENOENT' ? 'not installed' : result.error.message}`);
    if (result.status !== 0) throw new Error(`gh api ${path}: ${(result.stderr || '').trim() || `exit ${result.status}`}`);
    return JSON.parse(result.stdout);
  };
  const live = (artifacts) => artifacts.filter((a) => !a.expired);
  return {
    /**
     * GitHub builds of `digest` whose payload artifact can still be
     * downloaded, newest first: [{ runId, sha, created, expires }]. Throws
     * when gh cannot ask (not installed, not signed in, offline).
     */
    builds(manifest, digest) {
      const markers = live(api(`repos/${repo}/actions/artifacts?name=${markerName(manifest, digest)}&per_page=20`).artifacts ?? []);
      const out = [];
      for (const marker of markers.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
        const runId = marker.workflow_run?.id;
        if (!runId) continue;
        const payload = live(api(`repos/${repo}/actions/runs/${runId}/artifacts?name=${artifactName(manifest)}`).artifacts ?? [])[0];
        if (payload) out.push({ runId, sha: marker.workflow_run.head_sha ?? '', created: payload.created_at, expires: payload.expires_at });
      }
      return out;
    },
    /** Downloads the build's payload artifact into `dir` (gh run download). */
    download(build, manifest, dir) {
      const result = run(['run', 'download', String(build.runId), '-R', repo, '-n', artifactName(manifest), '-D', dir]);
      if (result.error || result.status !== 0) {
        throw new Error(`gh run download ${build.runId}: ${(result.stderr || result.error?.message || '').trim() || `exit ${result.status}`}`);
      }
    },
  };
}

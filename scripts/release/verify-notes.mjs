// The "Check this download" part of a GitHub release's notes. Pure. Each
// APK's SHA-256, the commit it was built from and our signing certificate;
// for a release our release workflow built (.github/workflows/release.yml),
// the exact `gh attestation verify` command too. Its flags pin the
// workflow, the commit and GitHub's own runners, because one file name can
// carry more than one attestation (a run that was never published leaves
// one too): the SHA-256 and the commit are what match.

/** The workflow that builds, signs and attests releases. */
export const RELEASE_WORKFLOW = '.github/workflows/release.yml';

/** True in a run of our release workflow (GitHub sets both), which attests the APKs. */
export function inReleaseWorkflow(env = process.env) {
  return env.GITHUB_ACTIONS === 'true' && (env.GITHUB_WORKFLOW_REF ?? '').includes(`/${RELEASE_WORKFLOW}@`);
}

/**
 * Markdown for the release notes. `apks`: [{ name, sha256 }] in the order
 * shown; `sha`: the full commit; `cert`: the signing certificate's SHA-256;
 * `attested`: built by the release workflow.
 */
export function verifyNotes({ repo, sha, cert, apks, attested }) {
  const lines = ['## Check this download', '', '| File | SHA-256 |', '|---|---|'];
  for (const apk of apks) lines.push(`| \`${apk.name}\` | \`${apk.sha256}\` |`);
  lines.push(
    '',
    `Built from commit [\`${sha}\`](https://github.com/${repo}/commit/${sha}). ` +
      `Signed with our key: \`apksigner verify --print-certs <apk>\` shows the certificate SHA-256 \`${cert}\`.`,
  );
  if (!attested) {
    lines.push('', 'Built on our own machine, so GitHub has no attestation for it.');
    return lines.join('\n');
  }
  const [first] = apks;
  lines.push(
    '',
    `Built and signed by [our release workflow](https://github.com/${repo}/blob/${sha}/${RELEASE_WORKFLOW}) ` +
      "on GitHub's runners, which attested both files. To check one:",
    '',
    '```sh',
    `gh attestation verify ${first ? first.name : '<apk>'} --repo ${repo} \\`,
    `  --signer-workflow ${repo}/${RELEASE_WORKFLOW} \\`,
    `  --source-digest ${sha} --deny-self-hosted-runners`,
    '```',
    '',
    'It proves this exact file came from that workflow at that commit, not that the code is safe. ' +
      'Match the SHA-256 and the commit, not the file name: a run that was never published can leave an attestation for the same name.',
  );
  return lines.join('\n');
}

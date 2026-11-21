import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inReleaseWorkflow, verifyNotes } from './verify-notes.mjs';

const SHA = 'ecd42dbb069e34ce5b41a18ff6076c505cb37e6b';
const base = {
  repo: 'o/r',
  sha: SHA,
  cert: 'c'.repeat(64),
  apks: [
    { name: 'phonecando-1.2.0-full-arm64.apk', sha256: 'f'.repeat(64) },
    { name: 'phonecando-1.2.0-lite-arm64.apk', sha256: 'e'.repeat(64) },
  ],
};

test('every release lists each APK, the commit and the certificate', () => {
  for (const attested of [true, false]) {
    const notes = verifyNotes({ ...base, attested });
    assert.match(notes, /^## Check this download/);
    assert.ok(notes.includes(`| \`phonecando-1.2.0-full-arm64.apk\` | \`${'f'.repeat(64)}\` |`));
    assert.ok(notes.includes(`| \`phonecando-1.2.0-lite-arm64.apk\` | \`${'e'.repeat(64)}\` |`));
    assert.ok(notes.includes(`https://github.com/o/r/commit/${SHA}`));
    assert.ok(notes.includes(`certificate SHA-256 \`${'c'.repeat(64)}\``));
  }
});

test('an attested release gives the verify command pinned to the workflow, the commit and GitHub runners', () => {
  const notes = verifyNotes({ ...base, attested: true });
  assert.ok(notes.includes('gh attestation verify phonecando-1.2.0-full-arm64.apk --repo o/r \\'));
  assert.ok(notes.includes('--signer-workflow o/r/.github/workflows/release.yml \\'));
  assert.ok(notes.includes(`--source-digest ${SHA} --deny-self-hosted-runners`));
  assert.match(notes, /not the file name/);
  assert.doesNotMatch(notes, /no attestation/);
});

test('a release built on our own machine says it has no attestation and gives no command', () => {
  const notes = verifyNotes({ ...base, attested: false });
  assert.match(notes, /GitHub has no attestation for it/);
  assert.doesNotMatch(notes, /gh attestation verify/);
});

test('only a run of our release workflow counts as attested', () => {
  const ref = 'o/r/.github/workflows/release.yml@refs/heads/prod';
  assert.equal(inReleaseWorkflow({ GITHUB_ACTIONS: 'true', GITHUB_WORKFLOW_REF: ref }), true);
  assert.equal(inReleaseWorkflow({ GITHUB_WORKFLOW_REF: ref }), false);
  assert.equal(inReleaseWorkflow({ GITHUB_ACTIONS: 'true', GITHUB_WORKFLOW_REF: 'o/r/.github/workflows/ci.yml@refs/heads/prod' }), false);
  assert.equal(inReleaseWorkflow({}), false);
});

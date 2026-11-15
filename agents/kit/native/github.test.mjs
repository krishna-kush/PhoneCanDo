// github.mjs: finding GitHub's builds of a digest by their marker artifact.
//   node --test agents/kit/native/github.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artifactName, makeGithub, markerName } from './github.mjs';

const manifest = { prefix: 'dm' };
const DIGEST = 'a'.repeat(64);

function fakeGh(routes) {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    const body = routes[args[1]];
    if (body === undefined) return { status: 1, stdout: '', stderr: `no route ${args[1]}` };
    return { status: 0, stdout: JSON.stringify(body), stderr: '' };
  };
  return { run, calls };
}

const marker = (runId, created, expired = false) => ({ created_at: created, expired, workflow_run: { id: runId, head_sha: `sha${runId}` } });
const payload = (expires, expired = false) => ({ created_at: '2026-11-15T04:02:00Z', expires_at: expires, expired });

test('names: the payload artifact and its inputs marker', () => {
  assert.equal(artifactName(manifest), 'dm-payload-arm64');
  assert.equal(markerName(manifest, DIGEST), `dm-payload-inputs-${DIGEST}`);
});

test('builds of the digest, newest first, skipping expired markers and payloads', () => {
  const { run } = fakeGh({
    [`repos/o/r/actions/artifacts?name=dm-payload-inputs-${DIGEST}&per_page=20`]: {
      artifacts: [marker(1, '2026-11-10T00:00:00Z'), marker(3, '2026-11-14T00:00:00Z'), marker(2, '2026-11-12T00:00:00Z'), marker(4, '2026-11-01T00:00:00Z', true)],
    },
    'repos/o/r/actions/runs/1/artifacts?name=dm-payload-arm64': { artifacts: [payload('2026-11-24T00:00:00Z')] },
    'repos/o/r/actions/runs/2/artifacts?name=dm-payload-arm64': { artifacts: [payload('2026-11-26T00:00:00Z', true)] },
    'repos/o/r/actions/runs/3/artifacts?name=dm-payload-arm64': { artifacts: [payload('2026-11-28T00:00:00Z')] },
  });
  const builds = makeGithub({ repo: 'o/r', run }).builds(manifest, DIGEST);
  assert.deepEqual(builds.map((b) => [b.runId, b.sha]), [[3, 'sha3'], [1, 'sha1']]);
});

test('no marker: no builds', () => {
  const { run } = fakeGh({ [`repos/o/r/actions/artifacts?name=dm-payload-inputs-${DIGEST}&per_page=20`]: { artifacts: [] } });
  assert.deepEqual(makeGithub({ repo: 'o/r', run }).builds(manifest, DIGEST), []);
});

test('gh failing throws, so the caller shows GitHub as not asked', () => {
  const missing = () => ({ error: Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' }) });
  assert.throws(() => makeGithub({ repo: 'o/r', run: missing }).builds(manifest, DIGEST), /gh: not installed/);
  const { run } = fakeGh({});
  assert.throws(() => makeGithub({ repo: 'o/r', run }).builds(manifest, DIGEST), /gh api/);
});

test('download runs gh run download for the payload artifact', () => {
  const { run, calls } = fakeGh({});
  const ok = (args) => (calls.push(args), { status: 0, stdout: '', stderr: '' });
  makeGithub({ repo: 'o/r', run: ok }).download({ runId: 3 }, manifest, '/d');
  assert.deepEqual(calls[0], ['run', 'download', '3', '-R', 'o/r', '-n', 'dm-payload-arm64', '-D', '/d']);
  assert.throws(() => makeGithub({ repo: 'o/r', run }).download({ runId: 3 }, manifest, '/d'), /gh run download 3/);
});

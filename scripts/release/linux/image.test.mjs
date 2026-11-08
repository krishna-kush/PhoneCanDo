// The Default image gate on staged-file descriptions and fake GitHub
// answers (no files, no network).
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fakeLinux,
  IMAGE_SHA,
  imageInfo,
  lockJson,
  NOT_STAGED,
  NULL_LOCK,
  okCheck,
  okImage,
  okRelease,
  okRun,
  RELEASE,
  REPO,
  RUN_ID,
  VERSION,
} from './fixtures.mjs';
import { imageGate, imageVerdict, parseLock } from './image.mjs';

const ok = (over = {}) => ({
  staged: okImage(),
  lock: parseLock(lockJson()),
  check: okCheck(),
  run: okRun(),
  release: okRelease(),
  ...over,
});

test('parseLock: all null is unlocked, set fields are read, broken JSON is an error', () => {
  assert.deepEqual(parseLock(NULL_LOCK), { locked: false });
  const lock = parseLock(lockJson());
  assert.deepEqual([lock.locked, lock.version, lock.release, lock.repo, lock.sha256, lock.size, lock.runId], [
    true,
    VERSION,
    RELEASE,
    REPO,
    IMAGE_SHA,
    48317668,
    RUN_ID,
  ]);
  assert.match(parseLock('{').error, /lock\.json is not JSON/);
});

test('the locked image, green run, sources released: ok, and what ships is recorded', () => {
  const verdict = imageVerdict(ok());
  assert.equal(verdict.ok, true, verdict.summary);
  assert.match(verdict.summary, /^Default image 20261107-e541287e is the locked one .* run 19000000001 green, sources in linux-image-/);
  assert.deepEqual(verdict.staged, { version: VERSION, sha256: IMAGE_SHA, release: RELEASE, info: 'e'.repeat(64) });
});

test('not staged: refused; the hint says how to stage, or to publish and lock first', () => {
  const locked = imageVerdict(ok({ staged: NOT_STAGED }));
  assert.equal(locked.ok, false);
  assert.match(locked.summary, /^no Default image staged: full and lite must ship Linux \(\.\/manage image fetch && \.\/manage image stage, or pass --without-linux\)$/);
  const unlocked = imageVerdict(ok({ staged: NOT_STAGED, lock: parseLock(NULL_LOCK) }));
  assert.equal(unlocked.ok, false);
  assert.match(unlocked.summary, /^no Default image is published and locked: publish the Default Debian image first: gh workflow run lre-image\.yml --ref prod -f publish=true; once that run is green, \.\/manage image lock <run-id>/);
  assert.match(unlocked.summary, /; or pass --without-linux$/);
});

test('not staged with --without-linux: ok, nothing ships, locked or not', () => {
  for (const lock of [lockJson(), NULL_LOCK]) {
    const verdict = imageVerdict(ok({ staged: NOT_STAGED, lock: parseLock(lock) }), { withoutLinux: true });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.staged, null);
  }
});

test('staged while lock.json locks nothing: refused, also with --without-linux', () => {
  for (const withoutLinux of [false, true]) {
    const verdict = imageVerdict({ staged: okImage(), lock: parseLock(NULL_LOCK) }, { withoutLinux });
    assert.equal(verdict.ok, false);
    assert.match(verdict.summary, /^lre\/images\/default\/lock\.json locks no image, so the staged one is unlocked: publish the Default Debian image first/);
  }
});

test('a local (stage --local) image in the release path: refused', () => {
  const staged = okImage({ info: imageInfo({ local: true, release: null }) });
  const verdict = imageVerdict(ok({ staged }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^the staged image is a local, unlocked build/);
});

test('image.json naming another sha256 than the lock: refused', () => {
  const staged = okImage({ info: imageInfo({ sha256: 'f'.repeat(64) }) });
  const verdict = imageVerdict(ok({ staged }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^image\.json names 20261107-e541287e \(sha256 ffffffffffff\), lock\.json locks 20261107-e541287e \(sha256 cccccccccccc\)/);
});

test('rootfs.tar.xz bytes not the locked ones: refused', () => {
  const verdict = imageVerdict(ok({ staged: okImage({ rootfs: { size: 48317668, sha256: 'f'.repeat(64) } }) }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^rootfs\.tar\.xz is not the locked image: sha256 ffffffffffff/);
});

test('half staged: refused', () => {
  assert.match(imageVerdict(ok({ staged: okImage({ rootfs: null }) })).summary, /rootfs\.tar\.xz is missing/);
  assert.match(imageVerdict(ok({ staged: okImage({ info: null, infoSha256: null }) })).summary, /image\.json is missing/);
});

test('the lock run not green, of another workflow, or gone: refused', () => {
  const red = imageVerdict(ok({ run: okRun({ conclusion: 'failure' }) }));
  assert.equal(red.ok, false);
  assert.match(red.summary, /^lock\.json's lre-image run 19000000001 is failure, not green/);
  assert.match(imageVerdict(ok({ run: okRun({ status: 'in_progress', conclusion: null }) })).summary, /is in_progress, not green/);
  assert.match(imageVerdict(ok({ run: okRun({ path: '.github/workflows/ci.yml' }) })).summary, /is \.github\/workflows\/ci\.yml, not \.github\/workflows\/lre-image\.yml/);
  assert.match(imageVerdict(ok({ run: 'missing' })).summary, /run 19000000001 does not exist/);
});

test('the image release without its GPL sources, or gone: refused', () => {
  const bare = okRelease();
  bare.assets = bare.assets.filter((asset) => !asset.name.includes('-sources-'));
  assert.match(imageVerdict(ok({ release: bare })).summary, /^linux-image-20261107-e541287e holds no GPL source bundle/);
  assert.match(imageVerdict(ok({ release: 'missing' })).summary, /has no published release linux-image-20261107-e541287e/);
});

test('check.sh --locked --remote failing: refused with its message', () => {
  const check = { status: 1, output: 'lock.json: linux-image-x is marked latest; that breaks app updates' };
  const verdict = imageVerdict(ok({ check, run: undefined, release: undefined }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /check\.sh --locked --remote failed: lock\.json: linux-image-x is marked latest/);
});

test('a dev-assets image is noted, never refused on its own', () => {
  const verdict = imageVerdict(ok({ staged: okImage({ dev: true }) }));
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail[0], /dev-assets\/default-image .* debug builds only/);
});

test('gate: asks check.sh and GitHub only for a staged image under a lock', () => {
  const asked = [];
  const gh = {
    runState: (repo, id) => (asked.push(['run', repo, id]), okRun()),
    releaseState: (repo, tag) => (asked.push(['release', repo, tag]), okRelease()),
  };
  const linux = fakeLinux();
  const state = {};
  const gate = imageGate({ linux, gh }, state);
  assert.deepEqual([gate.id, gate.ok, gate.overridable], ['image', true, false]);
  assert.deepEqual(asked, [['run', REPO, RUN_ID], ['release', REPO, RELEASE]]);
  assert.deepEqual(linux.asked, ['checkLock']);
  assert.equal(state.image.version, VERSION);

  asked.length = 0;
  const bare = fakeLinux({ image: NOT_STAGED });
  assert.equal(imageGate({ linux: bare, gh, withoutLinux: true }, state).ok, true);
  assert.deepEqual([asked, bare.asked, state.image], [[], [], null]);

  const failing = fakeLinux({ check: { status: 1, output: 'lock.json: bad' } });
  assert.equal(imageGate({ linux: failing, gh }, state).ok, false);
  assert.deepEqual(asked, [], 'no GitHub lookups after check.sh refused the lock');
});

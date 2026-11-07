// linux.mjs over a temp repo layout and a fake bash: no real staged files,
// no network.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { DEV_IMAGE_DIR, IMAGE_DIR, IMAGE_LOCK, makeLinux, PROOT_LIBS_DIR, PROOT_PINS } from './linux.mjs';

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'release-linux-'));
  roots.push(root);
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
  }
  return root;
}

const PINS = '# pins\nPROOT_VERSION=5.1.107.102\nPROOT_COMMIT=52d65a4d\n';
const LIB = Buffer.concat([Buffer.from('\x7fELF...'), Buffer.from('\x005.1.107.102\x00'), Buffer.from('rest')]);
const LOADER = Buffer.from('\x7fELF loader');

test('proot: digests, SHA256SUMS text, and the version marker', () => {
  const root = repo({
    [PROOT_PINS]: PINS,
    [`${PROOT_LIBS_DIR}/libproot.so`]: LIB,
    [`${PROOT_LIBS_DIR}/libproot-loader.so`]: LOADER,
    [`${PROOT_LIBS_DIR}/SHA256SUMS`]: `${sha(LIB)}  libproot.so\n`,
  });
  const proot = makeLinux({ root, run: () => assert.fail('no bash') }).proot();
  assert.deepEqual(proot.libs['libproot.so'], { size: LIB.length, sha256: sha(LIB) });
  assert.deepEqual(proot.libs['libproot-loader.so'], { size: LOADER.length, sha256: sha(LOADER) });
  assert.equal(proot.sums, `${sha(LIB)}  libproot.so\n`);
  assert.equal(proot.version, '5.1.107.102');
  assert.equal(proot.marked, true);
});

test('proot: nothing staged, or a lib of another version', () => {
  const empty = makeLinux({ root: repo({ [PROOT_PINS]: PINS }) }).proot();
  assert.deepEqual(empty.libs, { 'libproot.so': null, 'libproot-loader.so': null });
  assert.equal(empty.sums, null);
  assert.equal(empty.marked, false);
  const old = repo({ [PROOT_PINS]: PINS, [`${PROOT_LIBS_DIR}/libproot.so`]: Buffer.from('\x005.1.107.101\x00') });
  assert.equal(makeLinux({ root: old }).proot().marked, false);
  const longer = repo({ [PROOT_PINS]: PINS, [`${PROOT_LIBS_DIR}/libproot.so`]: Buffer.from('\x005.1.107.1021\x00') });
  assert.equal(makeLinux({ root: longer }).proot().marked, false);
});

test('image: the release-path files, and whether a dev image exists', () => {
  const rootfs = Buffer.from('xz bytes');
  const info = '{"version":"v"}\n';
  const root = repo({
    [`${IMAGE_DIR}/rootfs.tar.xz`]: rootfs,
    [`${IMAGE_DIR}/image.json`]: info,
    [`${DEV_IMAGE_DIR}/image.json`]: '{"local":true}',
    [IMAGE_LOCK]: '{"version":null}',
  });
  const linux = makeLinux({ root });
  assert.deepEqual(linux.image(), { rootfs: { size: rootfs.length, sha256: sha(rootfs) }, info, infoSha256: sha(info), dev: true });
  assert.equal(linux.lock(), '{"version":null}');
  const bare = makeLinux({ root: repo({}) }).image();
  assert.deepEqual(bare, { rootfs: null, info: null, infoSha256: null, dev: false });
});

test('checkLock: runs check.sh --locked --remote, answers 0, 1 and 3', () => {
  const root = repo({});
  const calls = [];
  const answer = (status, stdout, stderr) => (args) => (calls.push(args), { status, stdout, stderr });
  const ok = makeLinux({ root, run: answer(0, 'lock.json: v (a, 1 bytes, run 9), matches its GitHub release\n', '') }).checkLock();
  assert.deepEqual(ok, { status: 0, output: 'lock.json: v (a, 1 bytes, run 9), matches its GitHub release' });
  assert.deepEqual(calls[0], [join(root, 'lre/images/default/lock/check.sh'), '--locked', '--remote']);
  const bad = makeLinux({ root, run: answer(1, '', 'lock.json: sha256 is not 64 hex digits\n') }).checkLock();
  assert.deepEqual(bad, { status: 1, output: 'lock.json: sha256 is not 64 hex digits' });
  assert.equal(makeLinux({ root, run: answer(3, 'lock.json: no image locked yet\n', '') }).checkLock().status, 3);
});

test('checkLock: a check that cannot run throws', () => {
  const root = repo({});
  assert.throws(() => makeLinux({ root, run: () => ({ status: 2, stdout: '', stderr: 'usage' }) }).checkLock(), /usage/);
  const noBash = () => ({ status: null, stdout: '', stderr: '', error: new Error('spawn bash ENOENT') });
  assert.throws(() => makeLinux({ root, run: noBash }).checkLock(), /ENOENT/);
});

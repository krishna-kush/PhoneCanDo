// Test fixtures for the Linux gates: a staged proot and Default image that
// pass, the lock that names them, and GitHub's answers about its run and
// release. Tests copy and break them; nothing here touches the disk.

const hex = (c) => c.repeat(64);
export const REPO = 'krishna-kush/PhoneCanDo';
export const PROOT_VERSION = '5.1.107.102';
export const VERSION = '20261107-e541287e';
export const RELEASE = `linux-image-${VERSION}`;
export const ASSET = `phonecando-linux-default-${VERSION}-arm64.tar.xz`;
export const IMAGE_SHA = hex('c');
export const IMAGE_SIZE = 48317668;
export const RUN_ID = 19000000001;

/** linux/proot.mjs prootVerdict input: both libs, their SHA256SUMS, the pinned version. */
export const okProot = () => ({
  libs: {
    'libproot.so': { size: 288416, sha256: hex('a') },
    'libproot-loader.so': { size: 17624, sha256: hex('b') },
  },
  sums: `${hex('a')}  libproot.so\n${hex('b')}  libproot-loader.so\n`,
  version: PROOT_VERSION,
  marked: true,
});

export const lockJson = (over = {}) =>
  JSON.stringify({
    version: VERSION,
    release: RELEASE,
    asset: ASSET,
    url: `https://github.com/${REPO}/releases/download/${RELEASE}/${ASSET}`,
    repo: REPO,
    sha256: IMAGE_SHA,
    size: IMAGE_SIZE,
    debian_digest: `sha256:${hex('d')}`,
    snapshot: '20261107T000000Z',
    run_id: RUN_ID,
    ...over,
  });

export const NULL_LOCK = JSON.stringify(
  Object.fromEntries(
    ['version', 'release', 'asset', 'url', 'repo', 'sha256', 'size', 'debian_digest', 'snapshot', 'run_id'].map((k) => [k, null]),
  ),
);

/** What lock/stage.sh writes for the locked image. */
export const imageInfo = (over = {}) =>
  JSON.stringify({ version: VERSION, sha256: IMAGE_SHA, size: IMAGE_SIZE, release: RELEASE, snapshot: '20261107T000000Z', ...over });

/** linux/image.mjs imageVerdict `staged`: the locked image, staged. */
export const okImage = (over = {}) => ({
  rootfs: { size: IMAGE_SIZE, sha256: IMAGE_SHA },
  info: imageInfo(),
  infoSha256: hex('e'),
  dev: false,
  ...over,
});

export const NOT_STAGED = { rootfs: null, info: null, infoSha256: null, dev: false };

export const okCheck = () => ({ status: 0, output: `lock.json: ${VERSION} (${ASSET}, ${IMAGE_SIZE} bytes, run ${RUN_ID}), matches its GitHub release` });

export const okRun = (over = {}) => ({
  path: '.github/workflows/lre-image.yml',
  status: 'completed',
  conclusion: 'success',
  branch: 'prod',
  url: `https://github.com/${REPO}/actions/runs/${RUN_ID}`,
  ...over,
});

export const okRelease = () => ({
  draft: false,
  prerelease: true,
  assets: [
    { name: ASSET, size: IMAGE_SIZE },
    { name: `phonecando-linux-default-${VERSION}.json`, size: 2000 },
    { name: `phonecando-linux-default-${VERSION}-sources-01.tar`, size: 900_000_000 },
    { name: `phonecando-linux-default-${VERSION}-sources-index.tsv`, size: 40_000 },
  ],
});

/**
 * An io/linux.mjs stand-in: everything staged and locked unless overridden;
 * records whether check.sh ran.
 */
export function fakeLinux({ proot = okProot(), image = okImage(), lock = lockJson(), check = okCheck() } = {}) {
  const asked = [];
  return {
    asked,
    proot: () => proot,
    image: () => image,
    lock: () => lock,
    checkLock: () => (asked.push('checkLock'), check),
  };
}

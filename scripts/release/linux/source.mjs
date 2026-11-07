// proot's GPL corresponding source for an app release: the deterministic
// tarball lre/proot/source-tarball.sh packs (the pinned proot and talloc
// downloads plus our scripts, pins and patches). Every release that ships
// libproot.so attaches it; THIRD_PARTY_NOTICES.md and the app's Licenses
// screen promise it there. Pure: names, the downloads the pack needs, and
// what to do with a fresh pack next to a copy staged by an earlier run.

/** The asset name for `version` (pins.env PROOT_VERSION). */
export const sourceTarballName = (version) => `phonecando-proot-${version}-source.tar.gz`;

/**
 * The pinned downloads the pack reads from <workdir>/downloads (named as in
 * lre/proot/steps/sources.sh). Present and sha256-verified there, the pack
 * needs no network.
 */
export function sourceDownloads(pins) {
  return [
    { name: `proot-${pins.PROOT_COMMIT}.tar.gz`, sha256: pins.PROOT_SHA256 },
    { name: `talloc-${pins.TALLOC_VERSION}.tar.gz`, sha256: pins.TALLOC_SHA256 },
  ];
}

const short = (sha) => sha.slice(0, 12);

/**
 * staged: { sha256, size } of the copy an earlier run left in the release
 * stage, or null; fresh: the same for the pack just made.
 * -> { action: 'stage' | 'keep' | 'refuse', message }
 *    stage   nothing staged yet: move the fresh pack in
 *    keep    same bytes: the pack is deterministic, the staged copy stays
 *    refuse  different bytes for the same name: the proot sources or our
 *            scripts changed since, or the pack is not deterministic
 */
export function sourceDecision(staged, fresh, name) {
  if (!staged) return { action: 'stage', message: `${name}: packed, sha256 ${fresh.sha256} (${fresh.size} bytes)` };
  if (staged.sha256 === fresh.sha256 && staged.size === fresh.size) {
    return { action: 'keep', message: `${name}: packed again, same bytes as the staged copy (sha256 ${short(fresh.sha256)})` };
  }
  return {
    action: 'refuse',
    message:
      `${name}: a fresh pack (sha256 ${short(fresh.sha256)}) differs from the staged copy ` +
      `(sha256 ${short(staged.sha256)}). lre/proot changed since it was staged, or the pack is not ` +
      'deterministic; compare them, then delete the staged copy to release the fresh one',
  };
}

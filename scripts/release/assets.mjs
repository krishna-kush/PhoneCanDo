// What a release stages in dist/release/v<version>/ and uploads, the same
// list for a build run and for --upload-only. Pure: paths only.

import { join } from 'node:path';
import { sourceTarballName } from './linux/source.mjs';

/**
 * dir: the stage (dist/release/v<version>); proot: the preflight's staged
 * proot ({ version }) or null when the APKs ship none.
 * -> {
 *   full, lite, manifest   the APKs and latest.json
 *   source                 proot's GPL source tarball, or null
 *   uploads                every release asset, in upload order
 *   staged                 what --upload-only needs from the first run (the
 *                          source tarball is packed again and compared)
 * }
 */
export function releaseAssets({ dir, version, proot }) {
  const full = join(dir, `phonecando-${version}-full-arm64.apk`);
  const lite = join(dir, `phonecando-${version}-lite-arm64.apk`);
  const manifest = join(dir, 'latest.json');
  const source = proot ? join(dir, sourceTarballName(proot.version)) : null;
  return {
    full,
    lite,
    manifest,
    source,
    uploads: [full, lite, manifest, ...(source ? [source] : [])],
    staged: [full, lite, manifest],
  };
}

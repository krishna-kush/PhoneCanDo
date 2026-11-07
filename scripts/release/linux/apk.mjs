// Does a built full or lite APK carry exactly the Linux payloads the
// preflight checked? The build packs whatever is staged when Gradle runs
// (and --upload-only uploads APKs built earlier), so the staged files are
// compared with the APK's entries once more. Pure: the preflight's staged
// payloads and the APK's Linux entries (io/apk.mjs) in, problems out.

import { PROOT_LIBS } from './proot.mjs';

const ABI = 'arm64-v8a';
const IMAGE_DIR = 'assets/default-image/';

/** APK entries that belong to Linux: any ABI's proot libs and the image dir. */
export const isLinuxEntry = (name) =>
  name.startsWith(IMAGE_DIR) || /^lib\/[^/]+\/libproot(-loader)?\.so$/.test(name);

/**
 * proot: preflight.proot ({ libs: { name: sha256 } }) or null;
 * image: preflight.image ({ sha256, info: image.json's sha256 }) or null.
 * -> { entry: sha256 } the APK must hold, and no other Linux entry.
 */
export function expectedLinuxEntries({ proot, image }) {
  const out = {};
  if (proot) for (const name of PROOT_LIBS) out[`lib/${ABI}/${name}`] = proot.libs[name];
  if (image) {
    out[`${IMAGE_DIR}rootfs.tar.xz`] = image.sha256;
    out[`${IMAGE_DIR}image.json`] = image.info;
  }
  return out;
}

/** expected and found ({ entry: sha256 }) -> problem lines, empty when they agree. */
export function linuxEntryProblems(expected, found) {
  const problems = [];
  for (const [entry, sha256] of Object.entries(expected)) {
    if (!(entry in found)) problems.push(`${entry} is missing`);
    else if (found[entry] !== sha256) problems.push(`${entry} has sha256 ${found[entry]}, the staged file ${sha256}`);
  }
  for (const entry of Object.keys(found)) {
    if (!(entry in expected)) problems.push(`${entry} is in the APK but not in what the preflight checked`);
  }
  return problems;
}

// Reads an APK's Linux entries for linux/apk.mjs: their names (`unzip -Z1`)
// and the sha256 of each one's bytes (`unzip -p`). Read-only; `run` is
// injectable so tests never need an APK.
import { createHash } from 'node:crypto';
import { isLinuxEntry } from '../linux/apk.mjs';
import { failure, spawnRunner } from './spawn.mjs';

// The Default image is tens of MB; read whole, like the APK digests.
const MAX_ENTRY = 1024 * 1024 * 1024;

/** { linuxEntries(apk) -> { entry: sha256 } } over `run` (default: unzip, bytes out). */
export function makeApkReader({ run = spawnRunner('unzip', { encoding: 'buffer', maxBuffer: MAX_ENTRY }) } = {}) {
  const unzip = (args) => {
    const result = run(args);
    if (result.error || result.status !== 0) {
      throw new Error(`unzip ${args.join(' ')}: ${failure({ ...result, stderr: String(result.stderr ?? '') })}`);
    }
    return result.stdout;
  };
  return {
    linuxEntries(apk) {
      const names = String(unzip(['-Z1', apk])).split('\n').map((line) => line.trim()).filter(isLinuxEntry);
      // -p with a name is a wildcard pattern; the names here have none.
      return Object.fromEntries(
        names.map((name) => [name, createHash('sha256').update(unzip(['-p', apk, name])).digest('hex')]),
      );
    },
  };
}

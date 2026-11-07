// Reads what full and lite will ship as Linux, for the release preflight:
// the staged proot libs and their SHA256SUMS, lre/proot/pins.env, the
// staged Default image and lre/images/default/lock.json, and runs the lock's
// own check (check.sh --locked --remote: read-only GitHub GETs). Plain data
// out (linux/proot.mjs and linux/image.mjs decide). `root` is the repo root
// and `run` the bash runner, so tests point them at a temp dir and a fake.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parsePins, PROOT_LIBS } from '../linux/proot.mjs';
import { failure, spawnRunner } from './spawn.mjs';

const MODULE = 'app/modules/phonecando-linux/android/src/linux';
export const PROOT_LIBS_DIR = `${MODULE}/libs/arm64-v8a`;
export const IMAGE_DIR = `${MODULE}/assets/default-image`;
export const DEV_IMAGE_DIR = `${MODULE}/dev-assets/default-image`;
export const PROOT_PINS = 'lre/proot/pins.env';
export const IMAGE_LOCK = 'lre/images/default/lock.json';
const LOCK_CHECK = 'lre/images/default/lock/check.sh';

/** { size, sha256 } of a regular file, or null when there is none. */
export function digest(file) {
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  const bytes = readFileSync(file);
  return { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

const text = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

/** { proot(), pins(), image(), lock(), checkLock() } over the files under `root`. */
export function makeLinux({ root, run = spawnRunner('bash', { cwd: root }) }) {
  const at = (path) => join(root, path);
  const pins = () => parsePins(readFileSync(at(PROOT_PINS), 'utf8'));
  return {
    /** lre/proot/pins.env as { KEY: value }. */
    pins,
    /** linux/proot.mjs prootVerdict's input. */
    proot() {
      const dir = at(PROOT_LIBS_DIR);
      const version = pins().PROOT_VERSION ?? null;
      const libs = Object.fromEntries(PROOT_LIBS.map((name) => [name, digest(join(dir, name))]));
      // build-android.sh compiles -DVERSION="<PROOT_VERSION>" in: a C string.
      const marked =
        Boolean(version && libs['libproot.so']) &&
        readFileSync(join(dir, 'libproot.so')).includes(Buffer.from(`\0${version}\0`));
      return { libs, sums: text(join(dir, 'SHA256SUMS')), version, marked };
    },
    /** linux/image.mjs imageVerdict's `staged`. */
    image() {
      const dir = at(IMAGE_DIR);
      return {
        rootfs: digest(join(dir, 'rootfs.tar.xz')),
        info: text(join(dir, 'image.json')),
        infoSha256: digest(join(dir, 'image.json'))?.sha256 ?? null,
        dev: existsSync(at(DEV_IMAGE_DIR)),
      };
    },
    /** lock.json's text (linux/image.mjs parseLock reads it). */
    lock() {
      return readFileSync(at(IMAGE_LOCK), 'utf8');
    },
    /**
     * check.sh --locked --remote: { status, output } for its answers (0
     * valid, 1 not, 3 nothing locked; output is its message). Anything else
     * (no bash, a usage error) throws: a check that cannot run never passes.
     */
    checkLock() {
      const result = run([at(LOCK_CHECK), '--locked', '--remote']);
      if (result.error || ![0, 1, 3].includes(result.status)) throw new Error(`${LOCK_CHECK}: ${failure(result)}`);
      const output = [result.stderr, result.stdout].map((s) => (s || '').trim()).filter(Boolean).join('; ');
      return { status: result.status, output };
    },
  };
}

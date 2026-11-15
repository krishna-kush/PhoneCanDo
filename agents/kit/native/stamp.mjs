// The stamp a staged payload (and a downloaded payload artifact) carries next
// to its libs:
//   SHA256SUMS  `sha256sum` lines for every payload.libs name: the bytes
//   INPUTS      the digest of the sources it was built from (inputs.mjs)
//   SOURCE      one line: where it came from, e.g. "github run 4367 97a3802"
//               or "built on this PC 2026-11-15"
// AGP packages only *.so from a jniLibs dir, so none of them ships.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const SUMS = 'SHA256SUMS';
export const INPUTS = 'INPUTS';
export const SOURCE = 'SOURCE';

/** { size, sha256 } of a regular file, or null when there is none. */
export function fileDigest(path) {
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  const bytes = readFileSync(path);
  return { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** SHA256SUMS text for `names` in `dir`, in that order (as verify-elf.sh sums writes it). */
export function sumsText(dir, names) {
  return names.map((name) => `${fileDigest(join(dir, name)).sha256}  ${name}\n`).join('');
}

/** `sha256sum` output -> Map(name -> sha256); null when a line is not "<64 hex>  <name>". */
export function parseSums(text) {
  const sums = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^([0-9a-f]{64}) [ *](\S+)$/);
    if (!match || sums.has(match[2])) return null;
    sums.set(match[2], match[1]);
  }
  return sums;
}

const text = (path) => (existsSync(path) ? readFileSync(path, 'utf8').trim() : null);

/**
 * What `dir` holds for `manifest`'s payload: state.mjs stagedState's input.
 * -> { libs: [{ name, file: { size, sha256 } | null }], sums, inputs, source }
 *    (the stamp files' trimmed text, null when absent)
 */
export function readStamp(dir, manifest) {
  return {
    libs: (manifest.payload?.libs ?? []).map(({ name }) => ({ name, file: fileDigest(join(dir, name)) })),
    sums: text(join(dir, SUMS)),
    inputs: text(join(dir, INPUTS)),
    source: text(join(dir, SOURCE)),
  };
}

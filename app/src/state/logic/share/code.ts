// A share link's code: 8 characters from 32 letters and digits nobody
// misreads (no l, o, 0 or 1), one per share, made on the phone from random
// bytes. The server checks the same pattern before it counts anything.
// Pure (zero RN imports).

export const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export const CODE_LENGTH = 8;

const CODE_RE = /^[a-km-np-z2-9]{8}$/;

/** True for a well-formed share code. */
export function isShareCode(s: unknown): s is string {
  return typeof s === 'string' && CODE_RE.test(s);
}

/**
 * A code from random bytes, or null with fewer than CODE_LENGTH of them.
 * why the low 5 bits: 32 letters, so each byte picks one evenly.
 */
export function codeFromBytes(bytes: ArrayLike<number>): string | null {
  if (bytes.length < CODE_LENGTH) return null;
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[(bytes[i]! & 31)];
  return code;
}

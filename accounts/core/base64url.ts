// base64url (RFC 4648 §5, no padding), by hand so core needs no platform
// globals (no atob/btoa, no Buffer).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const INDEX = new Map<string, number>([...ALPHABET].map((c, i) => [c, i]));

/** Bytes as unpadded base64url. */
export function encodeBase64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]!;
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += ALPHABET[n >> 18]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]!;
  }
  return out;
}

/** Bytes of unpadded base64url text, or null when it is not valid base64url. */
export function decodeBase64url(text: string): Uint8Array<ArrayBuffer> | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let o = 0;
  for (const c of text) {
    const v = INDEX.get(c);
    if (v === undefined) return null;
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (value >> bits) & 0xff;
      value &= (1 << bits) - 1;
    }
  }
  // Leftover bits must be zero, or the text was not made by an encoder.
  if (value !== 0) return null;
  return out;
}

/** Unpadded base64url of `bytes` random bytes has this many chars. */
export function base64urlLength(bytes: number): number {
  return Math.ceil((bytes * 4) / 3);
}

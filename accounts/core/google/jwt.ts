// A compact JWS split into its parts. Decoding only: the signature is checked
// in verify.ts, and nothing read here is trusted before that.

import { decodeBase64url } from '../base64url.ts';

/** The parts of a JWT, with header and payload parsed. */
export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** `header.payload` as ASCII bytes: what the signature covers. */
  signedBytes: Uint8Array<ArrayBuffer>;
  signature: Uint8Array<ArrayBuffer>;
}

/** Splits and decodes a compact JWT, or null when it is not one. */
export function splitJwt(token: string): JwtParts | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  const header = jsonPart(h);
  const payload = jsonPart(p);
  const signature = decodeBase64url(s);
  if (!header || !payload || !signature || signature.length === 0) return null;
  return { header, payload, signedBytes: new Uint8Array(new TextEncoder().encode(`${h}.${p}`)), signature };
}

function jsonPart(text: string): Record<string, unknown> | null {
  const bytes = decodeBase64url(text);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

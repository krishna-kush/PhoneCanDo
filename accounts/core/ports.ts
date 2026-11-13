// What core needs from the platform, injected so core never calls
// Date.now(), crypto or fetch itself. runtime/ backs them with Web Crypto and
// fetch (Workers and Node 22 alike); tests back them with fakes.

/** Milliseconds since the epoch. */
export interface Clock {
  now(): number;
}

/** One of Google's RSA signing keys, as its JWKS lists it. */
export interface RsaPublicJwk {
  kid: string;
  n: string;
  e: string;
}

/** Randomness, hashing and RS256 checks. */
export interface CryptoPort {
  /** `length` cryptographically random bytes. */
  randomBytes(length: number): Uint8Array<ArrayBuffer>;
  /** A random UUID v4. */
  uuid(): string;
  /** SHA-256 of a UTF-8 string as lowercase hex. */
  sha256Hex(input: string): Promise<string>;
  /** True when `signature` is a valid RSASSA-PKCS1-v1_5 SHA-256 signature of `data` under `key`. */
  verifyRs256(key: RsaPublicJwk, data: Uint8Array<ArrayBuffer>, signature: Uint8Array<ArrayBuffer>): Promise<boolean>;
}

/** Google's signing key for a key id, or null when Google does not list it. Throws when the keys cannot be read. */
export interface KeySource {
  key(kid: string): Promise<RsaPublicJwk | null>;
}

/** Structured log lines. Never pass tokens, nonces, emails or Google account numbers. */
export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

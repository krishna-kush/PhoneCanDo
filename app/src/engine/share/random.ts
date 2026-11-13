// Random bytes for share codes, from expo-crypto (loaded lazily, like the
// telemetry adapter does, so a build without it still boots: links then go
// out untracked).

/** `n` random bytes; null when this build has no secure random source. */
export function randomBytes(n: number): Uint8Array | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const c = require('expo-crypto') as typeof import('expo-crypto');
    return c.getRandomBytes(n);
  } catch {
    return null;
  }
}

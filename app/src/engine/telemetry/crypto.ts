// expo-crypto, loaded lazily so a build without it must still boot: the
// module itself (the client's UUIDs, and whether a client can exist at all)
// and SHA-256 as lowercase hex for the identity hashes.

type CryptoModule = typeof import('expo-crypto');

let cryptoMod: CryptoModule | null | undefined;
export function cryptoModule(): CryptoModule | null {
  if (cryptoMod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cryptoMod = require('expo-crypto') as CryptoModule;
    } catch {
      cryptoMod = null;
    }
  }
  return cryptoMod;
}

export async function sha256Hex(input: string): Promise<string> {
  const c = cryptoModule();
  if (!c) throw new Error('expo-crypto is not in this build');
  const hex = await c.digestStringAsync(c.CryptoDigestAlgorithm.SHA256, input, {
    encoding: c.CryptoEncoding.HEX,
  });
  return hex.toLowerCase();
}

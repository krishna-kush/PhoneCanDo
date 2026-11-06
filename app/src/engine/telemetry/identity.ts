// Identity hashing: which strings are hashed, with which HASH_PEPPER, into
// the device id, the hardware hash, the forget proof and its verifier, and
// when the native DRM id hash rides along. Pure: the SHA-256 function is
// passed in, and the device facts are plain data.
import { HASH_PEPPER } from '../../../../tce/core/schema/limits.ts';
import type { DeviceFacts } from './device';

const HEX64 = /^[0-9a-f]{64}$/;

export type DeviceIds = { deviceId: string; hwHash: string; deviceVerifier: string; deviceProof: string };

/** The four ids hashed from ANDROID_ID and the hardware facts. */
export async function deriveIds(
  androidId: string,
  f: DeviceFacts,
  sha256Hex: (input: string) => Promise<string>,
): Promise<DeviceIds> {
  // No screen size: a foldable or a resolution switch would change it.
  const hw = [f.manufacturer, f.model, f.designName, f.productName, f.fingerprint, f.totalMemory ?? ''].join('|');
  const [deviceId, hwHash, deviceProof] = await Promise.all([
    sha256Hex(HASH_PEPPER.device + androidId),
    sha256Hex(HASH_PEPPER.hardware + hw),
    sha256Hex(HASH_PEPPER.forget + androidId),
  ]);
  // The verifier hashes the proof's 64-char lowercase hex string (see
  // HASH_PEPPER in tce/core/schema/limits.ts). Batches carry the verifier;
  // the proof goes only into Delete my data, and is never logged.
  const deviceVerifier = await sha256Hex(deviceProof);
  return { deviceId, hwHash, deviceVerifier, deviceProof };
}

/** `ids` plus `drm` as drmId when it is a 64-char lowercase hex hash. */
export function withDrmId(ids: DeviceIds, drm: string | null) {
  return drm && HEX64.test(drm) ? { ...ids, drmId: drm } : ids;
}

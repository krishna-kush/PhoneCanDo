// Identity rules. The server never sees raw hardware ids: device, hardware and
// DRM ids arrive as peppered SHA-256 hex made on the device (see HASH_PEPPER
// in schema/limits.ts), and the install id is a random UUID v4. The server
// only checks shapes; ids are never truncated or rewritten. The device
// verifier proves ownership of a deviceId: stores pin the first one they see.

import type { Edge } from './op.ts';
import type { DeviceRow } from './schema/rows.ts';
import type { DeviceWire } from './schema/wire.ts';
import type { Reader } from './validate.ts';

/** Lowercase RFC 4122 version-4 UUID (install ids). */
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Lowercase RFC 4122 UUID of any version (client-made session, error, report and batch ids). */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** 64 lowercase hex characters: a SHA-256 digest. */
export const HEX64 = /^[0-9a-f]{64}$/;

/** A validated identity; drmId is null when the device did not send one. */
export interface Identity {
  installId: string;
  deviceId: string;
  hwHash: string;
  drmId: string | null;
  /** SHA-256 hex of the device's forget proof (see HASH_PEPPER.forget). */
  deviceVerifier: string;
}

/** True for a lowercase UUID v4. */
export function isInstallId(s: string): boolean {
  return UUID_V4.test(s);
}

/** True for 64 lowercase hex characters. */
export function isHashId(s: string): boolean {
  return HEX64.test(s);
}

/** Read an IdentityWire at `field`. */
export function readIdentity(r: Reader, v: unknown, field: string): Identity {
  const o = r.object(v, field);
  return {
    installId: r.match(o.installId, `${field}.installId`, UUID_V4, 'a lowercase UUID v4'),
    deviceId: r.match(o.deviceId, `${field}.deviceId`, HEX64, '64 lowercase hex characters'),
    hwHash: r.match(o.hwHash, `${field}.hwHash`, HEX64, '64 lowercase hex characters'),
    drmId: r.optionalMatch(o.drmId, `${field}.drmId`, HEX64, '64 lowercase hex characters'),
    deviceVerifier: r.match(o.deviceVerifier, `${field}.deviceVerifier`, HEX64, '64 lowercase hex characters'),
  };
}

/**
 * The devices row a request from this identity writes, first and last seen at
 * `received`. Why one builder: batch and report both upsert the device (a
 * report pins the verifier of a phone that never sent a batch), and the
 * store's merge rules only hold if both send the same values for the same phone.
 */
export function deviceRowOf(identity: Identity, device: DeviceWire, edge: Pick<Edge, 'country' | 'asn'>, received: number): DeviceRow {
  return {
    device_id: identity.deviceId,
    verifier: identity.deviceVerifier,
    hw_hash: identity.hwHash,
    drm_id: identity.drmId,
    manufacturer: device.manufacturer,
    model: device.model,
    sdk_int: device.sdkInt,
    abi: device.abi,
    ram_gb: device.ramGb,
    locale: device.locale,
    country: edge.country,
    asn: edge.asn,
    tester: device.tester ? 1 : 0,
    first_seen: received,
    last_seen: received,
  };
}

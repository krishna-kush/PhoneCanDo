// The platform identity and device facts every request carries: the hashed
// platform ids and the forget proof, checked for shape once and cached, and
// the envelope (identity, device, app) a batch or report repeats.

import { HEX64 } from '../core/identity.ts';
import { err, ok, type TceResult } from '../core/result.ts';
import type { IdentityWire } from '../core/schema/wire.ts';
import type { Envelope } from './batch.ts';
import { newUuid, type ClientContext } from './context.ts';
import { describe } from './log.ts';
import { sanitizeApp, sanitizeDevice } from './sanitize.ts';

/**
 * The hashed platform ids and the forget proof, checked for shape once. A
 * proof equal to another id would put it in every batch, so that is refused
 * too.
 */
export async function platformIdentity(
  c: ClientContext,
): Promise<TceResult<{ wire: Omit<IdentityWire, 'installId'>; proof: string }>> {
  try {
    if (!c.identityCache || c.proofCache === null) {
      const id = await c.env.identity();
      const hex = (v: unknown): string => String(v ?? '').toLowerCase();
      const deviceId = hex(id?.deviceId);
      const hwHash = hex(id?.hwHash);
      const deviceVerifier = hex(id?.deviceVerifier);
      const deviceProof = hex(id?.deviceProof);
      const drmId = typeof id?.drmId === 'string' ? id.drmId.toLowerCase() : undefined;
      const shapes = [deviceId, hwHash, deviceVerifier, deviceProof].every((h) => HEX64.test(h));
      const distinct = deviceProof !== deviceId && deviceProof !== deviceVerifier && deviceProof !== hwHash;
      if (!shapes || !distinct || (drmId !== undefined && !HEX64.test(drmId))) {
        c.log.error('telemetry: platform identity is malformed; nothing sent');
        return err('bad_request', 'platform identity is malformed');
      }
      c.identityCache = drmId ? { deviceId, hwHash, drmId, deviceVerifier } : { deviceId, hwHash, deviceVerifier };
      c.proofCache = deviceProof;
    }
    return ok({ wire: c.identityCache, proof: c.proofCache });
  } catch (e) {
    c.log.warn('telemetry: platform identity unavailable', { error: describe(e) });
    return err('unavailable', `platform identity unavailable: ${describe(e)}`);
  }
}

/** The identity, device and app parts a batch or report carries (never the proof). */
export async function envelope(c: ClientContext): Promise<TceResult<Envelope>> {
  try {
    const id = await platformIdentity(c);
    if (!id.ok) return id;
    if (!c.deviceCache) c.deviceCache = await c.env.device();
    const identity: IdentityWire = { installId: c.install ?? newUuid(c), ...id.value.wire };
    return ok({ identity, device: sanitizeDevice(c.deviceCache, c.tester), app: sanitizeApp(c.env.app()) });
  } catch (e) {
    c.log.warn('telemetry: platform facts unavailable', { error: describe(e) });
    return err('unavailable', `platform facts unavailable: ${describe(e)}`);
  }
}

// forget(): Delete my data. Stops sending and waits for whatever is on the
// wire, asks the server to delete every row of this device by its proof,
// and then leaves the phone clean: queue wiped, telemetry off, a new
// install id. A failed or foreign answer changes nothing locally.

import { err, ok, type TceResult } from '../core/result.ts';
import { SCHEMA_VERSION } from '../core/schema/limits.ts';
import type { ForgetRequest, ForgetResponse } from '../core/schema/wire.ts';
import { newUuid, now, type ClientContext } from './context.ts';
import { flushIdle } from './flush.ts';
import { postJson } from './http.ts';
import { platformIdentity } from './identity.ts';
import { init } from './init.ts';
import { wipeLocal } from './local-data.ts';
import { describe } from './log.ts';
import { persistNow, setFlag } from './persistence.ts';
import { foreignBody, readForgetResponse } from './responses.ts';
import { rotateSession } from './sessions.ts';
import { STORAGE_KEYS } from './types.ts';

/** TceClient.forget: deletes all of this device's server data, then clears local state (see types.ts). */
export async function forget(c: ClientContext): Promise<TceResult<ForgetResponse>> {
  try {
    await init(c);
    c.forgetting = true;
    c.epoch++;
    try {
      // Stop sending and wait for whatever is already on the wire, so
      // no batch or report lands after the delete.
      await flushIdle(c);
      await Promise.allSettled([...c.reports]);
      const id = await platformIdentity(c);
      if (!id.ok) return id;
      const req: ForgetRequest = {
        schema: SCHEMA_VERSION,
        deviceId: id.value.wire.deviceId,
        deviceProof: id.value.proof,
      };
      const out = await postJson(c.net, `${c.baseUrl}/v1/forget`, JSON.stringify(req), c.timeoutMs, () => now(c));
      // The server's own not_found: it holds nothing for this device.
      const nothingStored = !out.ok && out.fromBody && out.error.code === 'not_found';
      if (!out.ok && !nothingStored) {
        c.log.warn('telemetry: forget not delivered', { code: out.error.code, status: out.status });
        return { ok: false, error: out.error };
      }
      const resp = out.ok ? readForgetResponse(out.json) : null;
      if (out.ok && !resp) {
        // Not the TCE's answer: nothing is known to be deleted, so nothing
        // local changes and the user can try again.
        c.log.warn('telemetry: forget not delivered', { code: 'unavailable', status: out.status });
        return { ok: false, error: foreignBody(out.status, 'forget') };
      }
      // Deleted, or nothing to delete: either way this phone ends clean.
      c.enabled = false;
      wipeLocal(c);
      c.install = newUuid(c);
      rotateSession(c);
      await setFlag(c, STORAGE_KEYS.enabled, '0');
      await setFlag(c, STORAGE_KEYS.installId, c.install);
      await persistNow(c);
      if (!resp) return err('not_found', 'nothing was stored on the server for this device');
      return ok(resp);
    } finally {
      c.forgetting = false;
    }
  } catch (e) {
    c.log.error('telemetry: forget failed', { error: describe(e) });
    return err('internal', `forget failed: ${describe(e)}`);
  }
}

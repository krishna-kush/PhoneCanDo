// POST /v1/forget: "Delete my data". The device proves it owns the deviceId
// with its forget proof: SHA-256 of the proof must equal the verifier the
// store pinned from the device's first batch (see HASH_PEPPER in
// schema/limits.ts). Then every row of that device, across all its installs,
// is deleted and the counts returned. Knowing a deviceId alone deletes nothing.

import { HEX64 } from '../identity.ts';
import type { HttpOp, HttpResponse, RequestCtx } from '../op.ts';
import { err, ok, type TceResult } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import type { ForgetResponse } from '../schema/wire.ts';
import { Reader } from '../validate.ts';
import { readEnvelope } from '../wire-read.ts';

/** The device to forget and its proof of ownership. */
export interface ForgetInput {
  deviceId: string;
  /** 64 lowercase hex; never stored or logged, only hashed. */
  deviceProof: string;
}

/** Validate a ForgetRequest body. */
export function parseForget(body: unknown): TceResult<ForgetInput> {
  const r = new Reader();
  const o = readEnvelope(r, body);
  return r.done({
    deviceId: r.match(o.deviceId, 'deviceId', HEX64, '64 lowercase hex characters'),
    deviceProof: r.match(o.deviceProof, 'deviceProof', HEX64, '64 lowercase hex characters'),
  });
}

/** The verifier a proof stands for: SHA-256 hex of the proof's lowercase hex string as UTF-8. */
export function proofVerifier(ctx: Pick<RequestCtx, 'hash'>, deviceProof: string): Promise<string> {
  return ctx.hash.sha256Hex(deviceProof);
}

/** POST /v1/forget. */
export const forgetOp: HttpOp<ForgetInput> = {
  kind: 'http',
  name: 'forget',
  method: 'POST',
  path: '/v1/forget',
  maxBodyBytes: LIMITS.smallBodyBytes,

  parse(req) {
    return parseForget(req.body);
  },

  async run(input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    const verifier = await proofVerifier(ctx, input.deviceProof);
    const res = await ctx.store.forget(input.deviceId, verifier);
    if (!res.ok) {
      // Why one message for an unknown device and a wrong proof: telling them
      // apart would let a caller probe which deviceIds exist.
      return res.error.code === 'not_found' ? err('not_found', 'no data for this device') : res;
    }
    const json: ForgetResponse = { deleted: res.value };
    return ok({ status: 200, json });
  },
};

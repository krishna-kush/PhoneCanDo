import { call } from "../client"
import type { Args } from "../tool"

// Bridge calls the composed tools are built from: observe, then act on the
// snapshot it returned. A failed call throws its readable error text, which
// `legacy` hands back to the model as the tool result.
async function pce(path: string, body: unknown, signal?: AbortSignal, timeoutMs = 15_000): Promise<any> {
  const text = await call(path, body, signal, timeoutMs)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text)
  }
}

export function observe(args: Args = {}, signal?: AbortSignal, timeoutMs = 15_000): Promise<any> {
  return pce("/pce/observe", { windows: false, maxNodes: 500, ...args }, signal, timeoutMs)
}

export function act(snapshotId: number, action: unknown, signal?: AbortSignal): Promise<any> {
  return pce("/pce/act", { snapshotId, action, timeoutMs: 30_000 }, signal, 35_000)
}

// Client timeout for one mobile_act call, from the bridge's caps
// (PceAutomationImpl.act): timeoutMs is clamped to 1-120 s (default 30 s)
// and bounds a wait; expectTimeoutMs to 0.5-30 s (default 5 s), used only
// with expect. The margin covers the last observe a wait runs before giving
// up. A fixed 35 s ended long waits in a client timeout while the action kept
// running. Stays under 280 s; HTTP clients give up near 300 s.
export function actTimeoutMs(args: Args): number {
  const ms = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  }
  const action = ms(args.timeoutMs, 1_000, 120_000, 30_000)
  const expect = args.expect ? ms(args.expectTimeoutMs, 500, 30_000, 5_000) : 0
  return Math.min(280_000, action + expect + 10_000)
}

// The composed tools' result: their value as JSON, or the error text.
export async function legacy(run: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await run())
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

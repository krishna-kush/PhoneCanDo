// The engine runs as a separate process from the app, so the agent reaches
// Android through the loopback bridge in PhoneCanDoServeService. URL + token come
// from the serve env (never hardcoded, never on disk).
const BASE = process.env.PHONECANDO_BRIDGE_URL
const TOKEN = process.env.PHONECANDO_BRIDGE_TOKEN

export type Args = Record<string, any>

export async function call(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  timeoutMs = 15_000,
): Promise<string> {
  if (!BASE || !TOKEN) {
    return "phonecando bridge unavailable: engine not started by PhoneCanDo (missing PHONECANDO_BRIDGE_URL/TOKEN)"
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const relay = () => ctrl.abort()
  signal?.addEventListener("abort", relay)
  try {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    const text = await res.text()
    let parsed: { ok?: boolean; data?: unknown; code?: string; message?: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      return `bridge ${res.status}: ${text.slice(0, 300)}`
    }
    if (parsed.ok === true) return JSON.stringify(parsed.data ?? {})
    return `error ${parsed.code ?? res.status}: ${parsed.message ?? "unknown"}`
  } catch (e) {
    if (ctrl.signal.aborted) return `bridge timeout (${Math.round(timeoutMs / 1000)}s)`
    return `bridge call failed: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", relay)
  }
}

// shortcut: this engine build (2.0.26) has no ctx.permission.assert (newer v2
// does), and Code Mode bypasses top-level rules for plugin tools. The trust
// gate is the app-side master switch checked by the bridge; restore per-call
// asserts when the engine is bumped.
export function bridgeTool(
  name: string,
  description: string,
  input: Record<string, unknown>,
  run: (args: Args, signal?: AbortSignal) => Promise<string>,
) {
  return {
    name,
    description,
    input,
    execute: async (args: Args, context?: { signal?: AbortSignal }) => ({
      content: await run(args ?? {}, context?.signal),
    }),
  }
}

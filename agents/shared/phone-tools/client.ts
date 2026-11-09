// The engine runs as a separate process from the app, so the agent reaches
// Android through the loopback bridge in the app process. URL + token come
// from the engine env (never hardcoded, never on disk); the token is this
// engine's own, so the bridge knows which agent is calling.
const BASE = process.env.PHONECANDO_BRIDGE_URL
const TOKEN = process.env.PHONECANDO_BRIDGE_TOKEN

type Envelope = {
  ok?: boolean
  data?: unknown
  code?: string
  message?: string
  holder?: string
  retryAfterMs?: number
}

// One bridge call; the result is always text for the model: the data as
// JSON, or a readable error. 15 s client timeout by default.
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
    let parsed: Envelope
    try {
      parsed = JSON.parse(text)
    } catch {
      return `bridge ${res.status}: ${text.slice(0, 300)}`
    }
    if (parsed.ok === true) return JSON.stringify(parsed.data ?? {})
    return errorText(parsed, res.status)
  } catch (e) {
    if (ctrl.signal.aborted) return `bridge timeout (${Math.round(timeoutMs / 1000)}s)`
    return `bridge call failed: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", relay)
  }
}

// `error <code>: <message>`. control_busy (another agent holds the screen)
// names the holder and how long to wait, so the model waits instead of
// hammering the bridge.
export function errorText(e: Envelope, status: number): string {
  if (e.code === "control_busy") {
    const secs = Math.max(1, Math.ceil((e.retryAfterMs ?? 30_000) / 1000))
    return `error control_busy: the screen is in use by ${e.holder ?? "another agent"}; try again in about ${secs}s. Wait, then call the tool again; do not loop quickly, and tell the user if it stays busy.`
  }
  return `error ${e.code ?? status}: ${e.message ?? "unknown"}`
}

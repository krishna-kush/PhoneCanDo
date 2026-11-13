// Reading a request's JSON body under a byte cap.

/** The parsed body (undefined when empty), or null when it is over `cap` or not JSON. */
export async function readJsonBody(request: Request, cap: number): Promise<{ value: unknown } | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > cap) return null;
  if (request.body === null) return { value: undefined };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel('body over cap').catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  if (total === 0) return { value: undefined };
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  try {
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)) };
  } catch {
    return null;
  }
}

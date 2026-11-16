// What went wrong, as one line of text: an Error's message, or anything else
// thrown spelled out. Pure (zero RN imports), so engine, state and screens
// all read errors the same way.
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

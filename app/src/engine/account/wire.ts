// What the accounts API answers (accounts/, /v1/account/*), read
// defensively: anything malformed reads as missing. Pure (zero RN imports).

/** The account as the server keeps it. */
export type AccountInfo = { email: string; createdAt: number };

/** One share link in the account's list: its code and when it was made (ms). */
export type AccountShareLink = { code: string; created: number };

/** A setting's value as the account keeps it. */
export type AccountSettingValue = string | number | boolean | null;

/** The account's settings by key, each with when a phone last changed it (ms). */
export type AccountSettings = Record<string, { value: AccountSettingValue; at: number }>;

function record(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** JSON text to a value; undefined when it is not JSON. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** An AccountWire object (or its JSON text); null when it isn't one. */
export function parseAccount(v: unknown): AccountInfo | null {
  const o = record(typeof v === 'string' ? parseJson(v) : v);
  if (!o || typeof o.email !== 'string' || typeof o.createdAt !== 'number' || !Number.isFinite(o.createdAt)) return null;
  return { email: o.email, createdAt: o.createdAt };
}

/** `{ links: [{ code, created }] }`'s well-formed entries; null when there is no list. */
export function parseAccountLinks(v: unknown): AccountShareLink[] | null {
  const list = record(v)?.links;
  if (!Array.isArray(list)) return null;
  const out: AccountShareLink[] = [];
  for (const item of list) {
    const o = record(item);
    if (o && typeof o.code === 'string' && typeof o.created === 'number' && Number.isFinite(o.created)) {
      out.push({ code: o.code, created: o.created });
    }
  }
  return out;
}

/** `{ settings: { key: { value, at } } }`'s well-formed entries; null when there is no map. */
export function parseAccountSettings(v: unknown): AccountSettings | null {
  const map = record(record(v)?.settings);
  if (!map) return null;
  const out: AccountSettings = {};
  for (const [key, item] of Object.entries(map)) {
    const o = record(item);
    if (!o || typeof o.at !== 'number' || !Number.isFinite(o.at)) continue;
    const value = o.value;
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      out[key] = { value, at: o.at };
    }
  }
  return out;
}

/** The `error` code of an error answer, or null. */
export function errorCode(v: unknown): string | null {
  const e = record(v)?.error;
  return typeof e === 'string' ? e : null;
}

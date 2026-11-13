// Joining this phone's settings with the account's. Each setting carries when
// this phone last changed it (0: never, the phone's default); the server
// keeps the later of each, and the phone takes back every setting the
// account holds from a later change than its own. A tie is the same change,
// so nothing moves. Pure (zero RN imports).

import { settingValue, SYNCED_KEYS, type SyncedKey, type SyncedSettings } from './keys.ts';

/** When this phone last changed each synced setting (ms); a missing key was never changed here. */
export type Stamps = Partial<Record<SyncedKey, number>>;

/** One setting as the account API speaks it. */
export type WireSetting = { value: string | number | boolean | null; at: number };

/** Every synced setting with when this phone last changed it, to send. */
export function outgoing(values: SyncedSettings, stamps: Stamps): Record<SyncedKey, WireSetting> {
  const out = {} as Record<SyncedKey, WireSetting>;
  for (const key of SYNCED_KEYS) out[key] = { value: values[key], at: stamps[key] ?? 0 };
  return out;
}

/** A setting to take from the account. */
export type Incoming = { [K in SyncedKey]: { key: K; value: SyncedSettings[K]; at: number } }[SyncedKey];

/**
 * The account's settings this phone should take: changed later than here,
 * and a value this build understands (anything else stays as it is).
 */
export function incoming(account: Record<string, { value: unknown; at: number }>, stamps: Stamps): Incoming[] {
  const out: Incoming[] = [];
  for (const key of SYNCED_KEYS) {
    const theirs = account[key];
    if (!theirs || theirs.at <= (stamps[key] ?? 0)) continue;
    const value = settingValue(key, theirs.value);
    if (value !== undefined) out.push({ key, value, at: theirs.at } as Incoming);
  }
  return out;
}

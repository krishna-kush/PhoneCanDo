// The settings the app keeps under an account, as the API speaks them:
// `{ "settings": { "<key>": { "value": v, "at": ms } } }`. The server keeps
// any key of this shape (the app decides which settings it sends;
// docs/accounts.md lists them), each a small plain value with the time a
// phone last changed it.

import { MAX_SETTINGS, SETTING_TEXT_MAX_CHARS } from './limits.ts';
import { err, ok, type Result } from './result.ts';
import type { SettingRow, SettingValue } from './store.ts';

/** A setting's key: a short camelCase name, e.g. `themeMode`. */
export const SETTING_KEY = /^[a-z][A-Za-z0-9]{0,47}$/;

/** The settings as the API answers them. */
export type SettingsWire = Record<string, { value: SettingValue; at: number }>;

/** Rows to the API's map. */
export function settingsWire(rows: readonly SettingRow[]): SettingsWire {
  const out: SettingsWire = {};
  for (const r of rows) out[r.key] = { value: r.value, at: r.at };
  return out;
}

/** Checks a PUT /v1/account/settings body. */
export function parseSettingsBody(body: unknown): Result<SettingRow[]> {
  if (!isObject(body) || !isObject(body.settings)) return err('bad_request', 'body must be { "settings": { ... } }');
  const entries = Object.entries(body.settings);
  if (entries.length > MAX_SETTINGS) return err('bad_request', `at most ${MAX_SETTINGS} settings`);
  const rows: SettingRow[] = [];
  for (const [key, entry] of entries) {
    if (!SETTING_KEY.test(key)) return err('bad_request', 'a setting key must be a short camelCase name');
    if (!isObject(entry)) return err('bad_request', `settings.${key} must be { value, at }`);
    const { value, at } = entry;
    if (!isSettingValue(value)) return err('bad_request', `settings.${key}.value must be a short text, a number, true, false or null`);
    if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < 0) {
      return err('bad_request', `settings.${key}.at must be a non-negative integer (ms)`);
    }
    rows.push({ key, value, at });
  }
  return ok(rows);
}

function isSettingValue(v: unknown): v is SettingValue {
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  return typeof v === 'string' && v.length <= SETTING_TEXT_MAX_CHARS;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

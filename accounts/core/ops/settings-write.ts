// PUT /v1/account/settings: a phone's settings joined with the account's.
// For each key the later change wins (a tie keeps the account's), so two
// phones changing different settings both keep theirs. The answer is the
// account's whole set, which the phone then takes where it is newer.

import { BODY_CAP, MAX_SETTINGS } from '../limits.ts';
import { ok } from '../result.ts';
import type { Route } from '../route.ts';
import { authenticate } from '../session.ts';
import { parseSettingsBody, settingsWire } from '../settings.ts';

/** PUT /v1/account/settings. */
export const settingsWriteRoute: Route = {
  name: 'settings_write',
  method: 'PUT',
  path: '/v1/account/settings',
  bucket: 'public',
  maxBodyBytes: BODY_CAP.settings,
  async handle(req, ctx) {
    const caller = await authenticate(req, ctx);
    if (!caller.ok) return caller;
    const rows = parseSettingsBody(req.body);
    if (!rows.ok) return rows;
    const kept = await ctx.store.mergeSettings(caller.value.account.id, rows.value, MAX_SETTINGS);
    return ok({ settings: settingsWire(kept) });
  },
};

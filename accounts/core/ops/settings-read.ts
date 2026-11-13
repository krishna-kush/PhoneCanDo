// GET /v1/account/settings: the settings the account keeps, for a phone
// that just signed in or came back to the front.

import { ok } from '../result.ts';
import type { Route } from '../route.ts';
import { authenticate } from '../session.ts';
import { settingsWire } from '../settings.ts';

/** GET /v1/account/settings. */
export const settingsReadRoute: Route = {
  name: 'settings_read',
  method: 'GET',
  path: '/v1/account/settings',
  bucket: 'public',
  maxBodyBytes: 0,
  async handle(req, ctx) {
    const caller = await authenticate(req, ctx);
    if (!caller.ok) return caller;
    return ok({ settings: settingsWire(await ctx.store.getSettings(caller.value.account.id)) });
  },
};

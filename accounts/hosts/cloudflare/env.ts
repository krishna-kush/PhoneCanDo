// What the accounts routes read from the Worker's environment (wrangler.jsonc
// of the Worker that mounts them).

import type { D1Like } from '../../stores/d1/index.ts';

/** Bindings and vars the accounts routes need. */
export interface AccountsEnv {
  /** D1 database `phonecando-accounts`. Absent (not bound yet): every route answers not_configured. */
  ACCOUNTS_DB?: D1Like;
  /** Comma list of Google OAuth client IDs an ID token may be for. Unset or empty: sign-in is off (not_configured). */
  GOOGLE_CLIENT_IDS?: string;
}

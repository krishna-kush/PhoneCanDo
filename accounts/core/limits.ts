// Every number the accounts API lives by, in one place (docs/accounts.md
// publishes them).

/** A nonce is good for one sign-in within this long. */
export const NONCE_TTL_MS = 10 * 60 * 1000;

/** A session ends after this long without use. */
export const SESSION_IDLE_MS = 180 * 24 * 60 * 60 * 1000;

/** A session's last use is written at most this often (one write a day, not one per call). */
export const SESSION_TOUCH_MS = 24 * 60 * 60 * 1000;

/** Share links an account keeps; the newest win. */
export const MAX_SHARES = 500;

/** Settings an account keeps; the most recently changed win. */
export const MAX_SETTINGS = 32;

/** A setting's text value is at most this long. */
export const SETTING_TEXT_MAX_CHARS = 200;

/** Random bytes in a session token and in a nonce (base64url: 43 chars). */
export const SECRET_BYTES = 32;

/** A Google ID token is about 1 KB; anything longer is refused unread. */
export const ID_TOKEN_MAX_CHARS = 4096;

/** Leeway for the phone's and Google's clocks on exp and iat. */
export const CLOCK_SKEW_S = 60;

/** Request body caps per route. */
export const BODY_CAP = {
  none: 0,
  signin: 8 * 1024,
  shares: 32 * 1024,
  settings: 8 * 1024,
} as const;

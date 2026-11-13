// Our API host: the tce Worker's /v1/* (usage stats, share counts) and
// accounts' /v1/account/*. Release builds talk to api.phonecando.app,
// debug builds to the local dev host (`pnpm -C tce dev` + `adb reverse
// tcp:8787 tcp:8787`). Kept apart from the site's domain so the backend can
// move without an app update.

/** The one production endpoint. */
export const API_HOST = 'https://api.phonecando.app';
/** The local dev host debug builds use. */
export const DEV_API_HOST = 'http://127.0.0.1:8787';

/** Where this build sends. */
export function apiBase(): string {
  return __DEV__ ? DEV_API_HOST : API_HOST;
}

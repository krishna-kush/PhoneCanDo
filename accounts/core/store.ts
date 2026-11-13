// Where accounts live. A backend implements AccountsStore; stores/sql builds
// one on any SQLite-dialect driver (D1 in production) and stores/memory is the
// reference for tests. A backend that fails throws; nothing here returns
// partial writes.

/** One person who signed in with Google. */
export interface AccountRow {
  /** Our own random id (UUID); never shown to anyone. */
  id: string;
  /** Google's account number (the ID token's `sub`). */
  googleSub: string;
  /** The Google account's email, updated on every sign-in. */
  email: string;
  /** First sign-in, ms. */
  created: number;
  /** Last sign-in or use (written at most once a day), ms. */
  lastSeen: number;
}

/** One signed-in phone. Only the token's SHA-256 is kept. */
export interface SessionRow {
  tokenHash: string;
  accountId: string;
  created: number;
  lastUsed: number;
}

/** A share link the account keeps, with when it was made (ms). */
export interface ShareLinkRow {
  code: string;
  created: number;
}

/** A setting's value: the app's choices are all small plain values. */
export type SettingValue = string | number | boolean | null;

/** One of the app's settings, with when a phone last changed it (ms, that phone's clock). */
export interface SettingRow {
  key: string;
  value: SettingValue;
  at: number;
}

/** The calls the ops make. */
export interface AccountsStore {
  /** Keeps a new nonce until `expires` and drops every nonce expired by `now`. */
  putNonce(nonce: string, expires: number, now: number): Promise<void>;
  /** Uses up a nonce: true when it was kept and had not expired at `now`; it is gone either way. */
  takeNonce(nonce: string, now: number): Promise<boolean>;
  /** Creates the account of a Google account number, or updates its email and lastSeen; `id` is used only when new. */
  upsertAccount(input: { id: string; googleSub: string; email: string; now: number }): Promise<AccountRow>;
  /** Keeps a new session. */
  createSession(row: SessionRow): Promise<void>;
  /** The session with this token hash and its account, or null. */
  findSession(tokenHash: string): Promise<{ session: SessionRow; account: AccountRow } | null>;
  /** Marks a session and its account used at `now`. */
  touchSession(tokenHash: string, accountId: string, now: number): Promise<void>;
  /** Deletes one session; true when it existed. */
  deleteSession(tokenHash: string): Promise<boolean>;
  /** Deletes every session last used before `before`; returns how many. */
  pruneSessions(before: number): Promise<number>;
  /**
   * Adds `links` to the account's list (a code it has keeps its earliest
   * `created`), keeps only the newest `cap`, and returns those, newest first.
   */
  mergeShares(accountId: string, links: readonly ShareLinkRow[], cap: number): Promise<ShareLinkRow[]>;
  /** The account's settings, by key. */
  getSettings(accountId: string): Promise<SettingRow[]>;
  /**
   * Takes each of `rows` whose `at` is later than the account's (a tie keeps
   * the account's), keeps only the `cap` most recently changed, and returns
   * them by key.
   */
  mergeSettings(accountId: string, rows: readonly SettingRow[], cap: number): Promise<SettingRow[]>;
  /** Deletes the account, every session of it, its share list and its settings. */
  deleteAccount(accountId: string): Promise<void>;
}

/** Newest first; equal times by code, so every store answers in the same order. */
export function byNewest(a: ShareLinkRow, b: ShareLinkRow): number {
  return b.created - a.created || (a.code < b.code ? 1 : a.code > b.code ? -1 : 0);
}

/** By key, so every store answers settings in the same order. */
export function byKey(a: SettingRow, b: SettingRow): number {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** Most recently changed first; equal times by key. */
export function byLatest(a: SettingRow, b: SettingRow): number {
  return b.at - a.at || byKey(a, b);
}

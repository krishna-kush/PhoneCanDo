// Optional Google sign-in, for screens and flows: whether it can work on
// this phone and build, the account's calls (accounts/, /v1/account/* on
// our API host) and signing out. The session token stays native; every
// call goes through the module's `request`, which adds it. A 401 means the
// session is gone (signed out elsewhere, account deleted, 180 days unused):
// the phone forgets it and reads as signed out.
import { apiBase } from '../apiHost';
import { GOOGLE_WEB_CLIENT_ID } from './config';
import { accountModule, type AccountProfile, type SignInError } from './native';
import {
  errorCode,
  parseAccount,
  parseAccountLinks,
  parseAccountSettings,
  parseJson,
  type AccountInfo,
  type AccountSettings,
  type AccountShareLink,
} from './wire';

export type { AccountInfo, AccountProfile, AccountSettings, AccountShareLink };

export type AccountError = SignInError | 'signed_out' | 'server';

export type AccountResult<T> = { ok: true; value: T } | { ok: false; error: AccountError; message: string | null };

function failed<T>(error: AccountError, message: string | null = null): AccountResult<T> {
  return { ok: false, error, message };
}

/** This phone can sign in with Google (the module is here and Google Play services are). */
export function accountSupported(): boolean {
  try {
    return accountModule()?.isSupported() === true;
  } catch {
    return false;
  }
}

/** This build knows our Google client (config.ts). */
export function accountConfigured(): boolean {
  return GOOGLE_WEB_CLIENT_ID.trim() !== '';
}

/** A session is kept on this phone. */
export function signedIn(): boolean {
  try {
    return accountModule()?.isSignedIn() === true;
  } catch {
    return false;
  }
}

/** Name, photo and email from the sign-in, kept on this phone only. */
export function accountProfile(): AccountProfile | null {
  try {
    return accountModule()?.profile() ?? null;
  } catch {
    return null;
  }
}

/** Google's account sheet, then our server; the session is kept natively. */
export async function signIn(): Promise<AccountResult<{ profile: AccountProfile; account: AccountInfo | null }>> {
  const m = accountModule();
  if (!m) return failed('unavailable');
  if (!accountConfigured()) return failed('not_configured');
  try {
    const r = await m.signIn(apiBase(), GOOGLE_WEB_CLIENT_ID.trim());
    if (!r.ok) return failed(r.error, r.message);
    return { ok: true, value: { profile: r.profile, account: parseAccount(r.account) } };
  } catch (e) {
    return failed('failed', e instanceof Error ? e.message : String(e));
  }
}

/** One signed-in call; its JSON body, or why not. */
async function call(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<AccountResult<unknown>> {
  const m = accountModule();
  if (!m) return failed('unavailable');
  let res;
  try {
    res = await m.request(apiBase(), method, path, body === undefined ? null : JSON.stringify(body));
  } catch (e) {
    return failed('failed', e instanceof Error ? e.message : String(e));
  }
  if (res.status === 0) return failed('network');
  const json = parseJson(res.body);
  if (res.status === 401) {
    try {
      m.clearLocal();
    } catch {
      // nothing kept to drop
    }
    return failed('signed_out');
  }
  if (res.status < 200 || res.status >= 300) {
    return failed(errorCode(json) === 'not_configured' ? 'not_configured' : 'server', errorCode(json));
  }
  return { ok: true, value: json };
}

/** The account as the server keeps it. */
export async function fetchAccount(): Promise<AccountResult<AccountInfo>> {
  const r = await call('GET', '/v1/account');
  if (!r.ok) return r;
  const account = parseAccount((r.value as { account?: unknown } | null)?.account);
  return account ? { ok: true, value: account } : failed('server');
}

/** Sends this phone's tracked links; the answer is the account's whole list. */
export async function syncAccountLinks(links: AccountShareLink[]): Promise<AccountResult<AccountShareLink[]>> {
  const r = await call('PUT', '/v1/account/shares', { links });
  if (!r.ok) return r;
  const list = parseAccountLinks(r.value);
  return list ? { ok: true, value: list } : failed('server');
}

/** Sends this phone's settings; the answer is the account's whole set, newer ones taken. */
export async function syncAccountSettings(settings: AccountSettings): Promise<AccountResult<AccountSettings>> {
  const r = await call('PUT', '/v1/account/settings', { settings });
  if (!r.ok) return r;
  const set = parseAccountSettings(r.value);
  return set ? { ok: true, value: set } : failed('server');
}

/** Ends the session on the server (best effort) and forgets it here. */
export async function signOut(): Promise<void> {
  const m = accountModule();
  if (!m) return;
  try {
    await m.signOut(apiBase());
  } catch {
    try {
      m.clearLocal();
    } catch {
      // nothing kept to drop
    }
  }
}

/** Deletes the account, its sessions and its link list on the server, then forgets it here. */
export async function deleteAccount(): Promise<AccountResult<void>> {
  const r = await call('POST', '/v1/account/delete');
  if (!r.ok) return r;
  try {
    accountModule()?.clearLocal();
  } catch {
    // gone on the server already
  }
  return { ok: true, value: undefined };
}

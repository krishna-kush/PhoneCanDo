// The native account module (modules/phonecando-account): Google sign-in
// through Android's Credential Manager, and the session token, which it
// keeps in the Keystore and adds to our requests itself: JS never sees it.
// Null where the module is absent (a native build older than sign-in).
import type {
  AccountProfile,
  AuthedResponse,
  SignInError,
  SignInResult,
} from '../../../modules/phonecando-account/src/PhoneCanDoAccountModule';

export type { AccountProfile, AuthedResponse, SignInError, SignInResult };

export type AccountModule = {
  isSupported(): boolean;
  isSignedIn(): boolean;
  profile(): AccountProfile | null;
  signIn(baseUrl: string, webClientId: string): Promise<SignInResult>;
  request(baseUrl: string, method: 'GET' | 'POST' | 'PUT', path: string, body: string | null): Promise<AuthedResponse>;
  signOut(baseUrl: string): Promise<void>;
  clearLocal(): void;
};

let cached: AccountModule | null | undefined;

/** The module, or null in a build without it. */
export function accountModule(): AccountModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../modules/phonecando-account/src/PhoneCanDoAccountModule');
    const impl = (mod?.default ?? mod) as Partial<AccountModule> | undefined;
    cached = typeof impl?.signIn === 'function' ? (impl as AccountModule) : null;
  } catch {
    cached = null;
  }
  return cached;
}

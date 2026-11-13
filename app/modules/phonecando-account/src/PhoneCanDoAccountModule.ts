import { NativeModule, requireOptionalNativeModule } from 'expo';

/** Who is signed in, as Google told the phone; kept on the phone only (the server keeps the email alone). */
export type AccountProfile = { email: string; name: string | null; photoUrl: string | null };

export type SignInError =
  | 'cancelled'
  | 'unavailable'
  | 'no_account'
  | 'network'
  | 'rejected'
  | 'not_configured'
  | 'failed';

export type SignInResult =
  /** `account` is the server's AccountWire as JSON: { email, createdAt }. */
  | { ok: true; profile: AccountProfile; account: string }
  | { ok: false; error: SignInError; message: string | null };

/** An accounts API answer; status 0 when no answer came (no network). */
export type AuthedResponse = { status: number; body: string };

declare class PhoneCanDoAccountModule extends NativeModule<{}> {
  /** Google Play services is installed and enabled (Sign in with Google needs it). */
  isSupported(): boolean;
  /** A session token is kept. */
  isSignedIn(): boolean;
  /** The signed-in profile; null when signed out. */
  profile(): AccountProfile | null;
  /** Nonce, Google's account sheet, /v1/account/signin; the session token goes into the Keystore vault. */
  signIn(baseUrl: string, webClientId: string): Promise<SignInResult>;
  /** One accounts API call with the session token added natively (never returned); a 401 signs the phone out. */
  request(
    baseUrl: string,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body: string | null,
  ): Promise<AuthedResponse>;
  /** Best-effort /v1/account/signout, then clears the token, the profile and Credential Manager's state. */
  signOut(baseUrl: string): Promise<void>;
  /** Drops the token and the profile on this phone only (after Delete account, or a 401). */
  clearLocal(): void;
}

// Optional: an APK built before this module has none; sign-in is then not
// offered. Only loads the module; app/src/engine/account/ is its seam.
export default requireOptionalNativeModule<PhoneCanDoAccountModule>('PhoneCanDoAccount');

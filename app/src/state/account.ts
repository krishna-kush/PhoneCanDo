// Optional Google sign-in, as screens show it: whether it can work here,
// who is signed in (name, photo and email kept on this phone by the native
// module) and the account as the server keeps it. The session token stays
// native. Multi-step actions are flows/account.ts.
import { create } from 'zustand';
import {
  accountConfigured,
  accountProfile,
  accountSupported,
  signedIn,
  type AccountError,
  type AccountInfo,
  type AccountProfile,
} from '../engine/account';

export type AccountBusy = 'signIn' | 'signOut' | 'delete' | null;

type AccountState = {
  /** Google Play services and the native module are here. */
  supported: boolean;
  /** This build knows our Google client. */
  configured: boolean;
  signedIn: boolean;
  profile: AccountProfile | null;
  /** The server's view, once read this run. */
  account: AccountInfo | null;
  busy: AccountBusy;
  /** The last action's failure, until the next one starts. */
  error: AccountError | null;

  /** Re-reads what the phone keeps (cheap, synchronous native reads). */
  hydrate: () => void;
  set: (patch: Partial<Pick<AccountState, 'signedIn' | 'profile' | 'account' | 'busy' | 'error'>>) => void;
};

export const useAccountStore = create<AccountState>((set) => ({
  supported: false,
  configured: false,
  signedIn: false,
  profile: null,
  account: null,
  busy: null,
  error: null,

  hydrate: () => {
    const isIn = signedIn();
    set({
      supported: accountSupported(),
      configured: accountConfigured(),
      signedIn: isIn,
      profile: isIn ? accountProfile() : null,
      ...(isIn ? {} : { account: null }),
    });
  },
  set: (patch) => set(patch),
}));

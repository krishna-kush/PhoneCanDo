// Google sign-in's steps: sign in, then join this phone's share links and
// settings with the account's (both ways, so a new phone gets them back); re-read the
// account; sign out; delete the account. A cancelled sign-in is no error.
// A call that finds the session gone re-reads the phone as signed out.
import {
  deleteAccount,
  fetchAccount,
  signIn,
  signOut,
  syncAccountLinks,
  signedIn,
  type AccountError,
} from '../../engine/account';
import { useAccountStore } from '../account';
import { forAccount } from '../logic/share/list';
import { useShareStore } from '../share';
import { syncSettingsWithAccount } from './settingsSync';

function goneIfSignedOut(error: AccountError) {
  if (error === 'signed_out') useAccountStore.getState().hydrate();
}

let syncing: Promise<void> | null = null;

/** Sends this phone's tracked links and takes the account's back. No-op while signed out. */
export function syncLinksWithAccount(): Promise<void> {
  syncing ??= (async () => {
    try {
      if (!signedIn()) return;
      await useShareStore.getState().hydrate();
      const r = await syncAccountLinks(forAccount(useShareStore.getState().links));
      if (r.ok) useShareStore.getState().mergeAccount(r.value);
      else goneIfSignedOut(r.error);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Google's account sheet, our server, then the links. */
export async function signInWithGoogle(): Promise<void> {
  const store = useAccountStore.getState();
  if (store.busy) return;
  store.set({ busy: 'signIn', error: null });
  const r = await signIn();
  if (!r.ok) {
    useAccountStore.getState().set({ busy: null, error: r.error === 'cancelled' ? null : r.error });
    return;
  }
  useAccountStore.getState().set({ busy: null, signedIn: true, profile: r.value.profile, account: r.value.account });
  await Promise.all([syncLinksWithAccount(), syncSettingsWithAccount()]);
}

/** Re-reads the account from the server (and notices a session that ended elsewhere). */
export async function refreshAccount(): Promise<void> {
  if (!signedIn()) {
    useAccountStore.getState().hydrate();
    return;
  }
  const r = await fetchAccount();
  if (r.ok) useAccountStore.getState().set({ account: r.value });
  else goneIfSignedOut(r.error);
}

/** Ends the session; the links stay on this phone. */
export async function signOutOfAccount(): Promise<void> {
  const store = useAccountStore.getState();
  if (store.busy) return;
  store.set({ busy: 'signOut', error: null });
  await signOut();
  useAccountStore.getState().set({ busy: null, account: null });
  useAccountStore.getState().hydrate();
}

/** Deletes the account on the server; true once it is gone. The links stay on this phone. */
export async function deleteMyAccount(): Promise<boolean> {
  const store = useAccountStore.getState();
  if (store.busy) return false;
  store.set({ busy: 'delete', error: null });
  const r = await deleteAccount();
  if (!r.ok) {
    useAccountStore.getState().set({ busy: null, error: r.error });
    goneIfSignedOut(r.error);
    return false;
  }
  useAccountStore.getState().set({ busy: null, account: null });
  useAccountStore.getState().hydrate();
  return true;
}

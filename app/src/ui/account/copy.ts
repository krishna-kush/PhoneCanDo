// Every line of the optional Google sign-in: the Settings row and the
// Account page. Pure (zero RN imports).
import type { AccountError } from '../../engine/account/index.ts';

export const ROW_TITLE = 'Account';
export const ROW_LINE = 'Optional: sign in with Google so your links and settings follow you';

/** The Settings row's "how it is now". */
export function rowNow(a: { signedIn: boolean; email: string | null; offered: boolean }): string {
  if (a.signedIn) return a.email ?? 'signed in';
  return a.offered ? 'signed out · optional' : 'not on this phone or build';
}

export const TITLE = 'Account';

export const WHY =
  'Optional. Sign in with Google and the links you share, your theme, extra keys and run caps come with you to every phone you sign in on. Everything else works the same without it.';

/** Signed in: what follows you now. */
export const SYNCED =
  'Your share links, theme, extra keys and run caps follow you to every phone you sign in on. Change one here and your other phones catch up the next time they open.';

export const COMING_TITLE = 'Coming, also optional';
export const COMING_LINE =
  "Sign-in is here now so these can join you later. They'll need it, and they'll stay optional: everything you do today keeps working without an account.";

/** What a signed-in crew gets next (docs/planning/todo.md, Account: coming features). */
export const COMING: readonly { title: string; line: string }[] = [
  { title: 'Share chats with friends', line: "Send a friend a chat with your agent, to read through or carry on in their own." },
  { title: 'Use a local agent together', line: "Invite friends into your agent's chat and work with it side by side, live, each from their own phone." },
  { title: 'Share compute', line: "Lend your phone's spare power and local models to a friend's agents, or borrow theirs for a big job." },
  { title: 'More fun together', line: 'And other things to do with your crew, each one optional too.' },
];
export const WHAT_WE_KEEP =
  "We keep your email, Google's account number, your share links' codes and those settings, and only if you sign in. Never your chats, keys or files, and your usage stats stay anonymous: they are never linked to your account.";
export const SIGN_IN = 'Sign in with Google';

export const NOT_CONFIGURED = "Sign-in isn't set up in this build yet. Everything else works without it.";
export const NO_PLAY_SERVICES = "Sign-in needs Google Play services, which this phone doesn't have. Everything else works without it.";

export const SIGNED_IN_AS = 'Signed in with Google';
export const SIGN_OUT = 'Sign out';
export const SIGN_OUT_NOTE = 'Signing out keeps your links and settings on this phone; sign in again any time.';
export const DELETE = 'Delete account';
export const DELETE_NOTE =
  'Deletes your account, your email, your list of links and your synced settings from our server. Links you already sent keep counting, and this phone keeps its links and settings.';
export const DELETE_CONFIRM_TITLE = 'Delete your account?';
export const DELETE_CONFIRM_MESSAGE =
  'Your email, your account, its list of links and its settings are removed from our server. This phone keeps its links and settings. You can sign in again later, as a new account.';
export const DELETED = 'Account deleted. Nothing of it is left on our server.';

/** Since when the account exists, as a date. */
export function sinceLine(createdAt: number): string {
  const d = new Date(createdAt);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `member since ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** What went wrong, in a line; null for nothing worth saying. */
export function errorLine(e: AccountError | null): string | null {
  switch (e) {
    case null:
    case 'cancelled':
      return null;
    case 'no_account':
      return 'No Google account on this phone. Add one in Android settings, then try again.';
    case 'unavailable':
      return NO_PLAY_SERVICES;
    case 'not_configured':
      return NOT_CONFIGURED;
    case 'network':
      return "Couldn't reach our server. Check your connection and try again.";
    case 'rejected':
      return 'Our server turned that sign-in down. Try again in a bit.';
    case 'signed_out':
      return 'You were signed out (from another phone, or after a long while). Sign in again.';
    case 'server':
    case 'failed':
      return 'Something went wrong. Try again in a bit.';
  }
}

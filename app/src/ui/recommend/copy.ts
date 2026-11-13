// Every line of "recommend PhoneCanDo to a friend": what the share sheet
// sends, the Settings row, the "Having fun?" card and the Refer page. The
// link is phonecando.app/i/<code> when tracked (state/logic/share/link.ts),
// so the site can count what it did. Pure (zero RN imports).

export const SHARE_TITLE = 'Share PhoneCanDo';

/** What the share sheet sends, with the link. */
export function shareMessage(link: string): string {
  return (
    'PhoneCanDo: AI that can use your phone. Agents that write code, run Linux and work your apps for you, ' +
    `right on your Android phone. Give it a try: ${link}`
  );
}

export const ROW_TITLE = 'Tell a friend';
export const ROW_LINE = 'Spread the crew: send a link, then watch what it did';

/** The Settings row's "how it is now": how many links went out. */
export function rowNow(sent: number): string {
  if (sent === 0) return 'no links sent yet';
  return sent === 1 ? '1 link sent' : `${sent} links sent`;
}

export const CARD_LINE = 'Having fun with PhoneCanDo? Share it with your friends so they can have fun too.';
export const CARD_SHARE = 'Share';
export const CARD_NOT_NOW = 'Not now';
export const CARD_NEVER = "Don't ask again";

// --- the Refer page -----------------------------------------------------------

export const REFER_TITLE = 'Tell a friend';
export const REFER_KICKER_LINE = 'every link gets its own tiny tracker';
export const REFER_LEAD =
  "Send PhoneCanDo to someone who'd have fun with it. Each share gets its own link, so you can see what it did: opened, downloaded, installed.";
export const REFER_SHARE = 'Share PhoneCanDo';
export const REFER_PRIVACY =
  'We count opens, downloads and installs per link. Never who: nothing about your friends reaches us or you.';
export const REFER_INSTALL_NOTE =
  'Installed counts friends who open PhoneCanDo through your link after installing it, so the real number can be higher.';

export const UNTRACKED_STATS_OFF = 'Usage stats are off, so new links go out untracked. Turn them on in Privacy to see what your links do.';
export const UNTRACKED_DEBUG = 'Debug build: links are tracked only with "Send to local dev host" on (Privacy).';
export const SIGN_IN_HINT = 'Sign in (Settings → Account) and these links come with you to a new phone.';

export const STATS_LOADING = 'Asking the server…';
export const STATS_FAILED = "Couldn't reach our server. The counts will show next time.";
export const NO_LINKS = 'Nothing sent yet. Your first link shows up here.';

export const LINKS_TITLE = 'Your links';
export const FUNNEL_TITLE = 'What your links did';

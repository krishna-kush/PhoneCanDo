// Every line of "recommend PhoneCanDo to a friend": what the share sheet
// sends, the Settings row, the "Having fun?" card and the Refer page. The
// link is phonecando.app/i/<code> when tracked (state/logic/share/link.ts),
// so the site can count what it did. Pure (zero RN imports).

export const SHARE_TITLE = 'Share PhoneCanDo';

/**
 * What the share sheet sends: one of these, in the sharer's own voice,
 * then the link on a line of its own. Plain text, one emoji at most: share
 * sheets and SMS mangle anything fancier.
 */
export const SHARE_LINES = [
  'Meet A-01, a tiny robot that runs coding agents right on my phone. Real Linux, real code, and it can even drive the phone itself. Your turn:',
  'My phone writes code now. PhoneCanDo runs coding agents on Android, a whole Linux inside, and they tap around the phone too. A-01 saved you a seat:',
  'A-01 (the little robot in charge) told me to send you this. PhoneCanDo puts coding agents on your phone that see the screen and tap for you. Try it:',
  'Plot twist: my phone has coworkers. PhoneCanDo runs AI coding agents right on Android, Linux and all, and they work my apps. A-01 says come over 🤖',
  'I gave my phone a dev team. PhoneCanDo: coding agents that live on your Android phone and open apps and type for you. A-01 will show you around:',
  'My phone just opened an app, typed a message and wrote some code. PhoneCanDo: coding agents with eyes and hands. Say hi to A-01:',
  'Coding agents that run on your phone AND tap through it for you. A-01, the robot on the box, says this is fine. Probably:',
  'Told my phone to fix a bug. Then it fixed it. PhoneCanDo runs coding agents on Android with a real Linux, and A-01 cheers them on:',
  'Your phone, now with eyes and hands: PhoneCanDo agents write code, run Linux and tap through apps for you. A-01 is waiting at the door:',
  'Warning: your phone may start doing your chores. PhoneCanDo agents code, run Linux and can drive the screen. A-01 approves:',
  'No laptop, no problem. PhoneCanDo runs coding agents on Android, and they can see the screen and tap for you. Come meet A-01 🤖',
  'A-01 here, on behalf of my phone: it writes code now, and it opens apps and types too. PhoneCanDo, coding agents on Android:',
] as const;

/**
 * The share sheet's text for `link` with line number `turn` (share.ts moves
 * it on each time the sheet opens), coming round again after the last, so
 * the line changes whatever the link (an untracked one is the bare site,
 * the same every time).
 */
export function shareMessage(link: string, turn: number): string {
  return `${SHARE_LINES[Math.max(0, turn) % SHARE_LINES.length]}\n${link}`;
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

/** The stamp under Share once a link went out on this visit. */
export function sentStamp(shares: number): string {
  return shares === 1 ? 'Sent!' : `Sent ×${shares}`;
}
export const REFER_PRIVACY =
  'We count opens, downloads and installs per link. Never who: nothing about your friends reaches us or you.';
export const REFER_INSTALL_NOTE =
  'Installed counts friends who open PhoneCanDo through your link after installing it, so the real number can be higher.';

export const UNTRACKED_STATS_OFF = 'Usage stats are off, so new links go out untracked. Turn them on in Privacy to see what your links do.';
export const UNTRACKED_DEBUG = 'Debug build: links are tracked only with "Send to local dev host" on (Privacy).';
export const SIGN_IN_HINT = 'Sign in (Settings → Account) and these links come with you to a new phone.';

export const STATS_LOADING = 'Asking the server…';
export const STATS_FAILED = "Couldn't reach our server. The counts will show next time.";
export const NO_LINKS = 'Nothing sent yet. Your first link lands here, with its own tiny tracker.';

export const LINKS_TITLE = 'Your links';
export const FUNNEL_TITLE = 'What your links did';

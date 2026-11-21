// Settings → Privacy's words, as a customs declaration for what leaves the
// phone. Every claim is the page's own from before, said the same way, and
// must stay true to docs/telemetry.md: what goes out is declared, what never
// does is stamped. Only the framing is new. Pure (zero RN imports).

/** What usage stats send, under a random anonymous ID. */
export const DECLARED = [
  'Your device type',
  'Android and app version',
  'Crashes',
  'Engine health',
  'How often features are used',
] as const;

export const DECLARED_TITLE = 'Declared · goes out';
export const DECLARED_NOTE = 'Under a random anonymous ID, only while usage stats are on.';

/** What is never sent. */
export const NEVER = ['Your chats', 'Files', 'Keys', 'Anything on your screen'] as const;

export const NEVER_TITLE = 'Never sent';
export const NEVER_STAMP = 'never';

/** The usage-stats switch: its line now, and what Off does. */
export function statsNote(ready: boolean, enabled: boolean): string {
  if (!ready) return 'Loading…';
  return enabled ? 'On · helps find bugs' : 'Off · nothing is sent';
}
export const OFF_MEANS = 'Off stops it and deletes what has not been sent yet.';

/** A-01 at the desk: on duty with the switch on, eyes shut with it off. */
export function guardLine(ready: boolean, enabled: boolean): { title: string; line: string } {
  if (!ready) return { title: 'A-01 · reading the form', line: 'One moment.' };
  return enabled
    ? { title: 'A-01 · on duty', line: 'Counting only what is declared below.' }
    : { title: 'A-01 · off duty', line: 'Eyes shut. Nothing is sent.' };
}

/** Share links and the optional sign-in, said as before. */
export const ALSO = [
  {
    title: 'Tell a friend links',
    note: 'Each link you share carries a random code, so we can count how often it was opened, downloaded and installed. Never who. Links you share while this is off go out untracked.',
  },
  {
    title: 'Google sign-in (optional)',
    note: "Settings → Account. We keep your email, your links' codes and a few settings (theme, extra keys, run caps) only if you sign in. Those codes are in these usage stats too, so signed in, the two aren't fully apart.",
  },
] as const;

export const RESET_NOTE =
  'Starts a new install ID and drops data not sent yet. Data already sent stays linked to this phone; Delete my data removes it.';
export const REPORT_OFF_NOTE = 'Turn usage stats on to send one.';
export const REPORT_NOTE = 'One report you write, with recent events and the redacted engine log tail. Only when you tap it.';
export const FORGET_NOTE = 'All usage data the server holds for this phone goes through the shredder, then sharing turns off.';

export const NOT_IN_BUILD = 'Usage stats are not available in this build, so nothing is sent.';

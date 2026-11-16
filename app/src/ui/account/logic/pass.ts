// The Account page's crew pass and what follows you, in words: the pass's
// fields filled in or blank, A-01's line by the door, and each setting
// that comes with a signed-in person. Pure (zero RN imports).
import { sinceDate } from '../copy.ts';

export type PassField = { term: string; value: string };

/** The pass's strip: issued once signed in. */
export const PASS_TITLE = 'Crew pass';
export const PASS_TITLE_BLANK = 'Crew pass · not issued';

/** Slammed on a signed-in pass. */
export const PASS_STAMP = 'Signed in';

/** Under the photo slot: we never load the photo, so A-01 stands in. */
export const PHOTO_CAPTION = 'A-01 stood in';
export const PHOTO_CAPTION_BLANK = 'no photo needed';

/** The pass's foot while signed in, beside its live light. */
export const LINKED_LINE = 'Linked · your settings follow you';

/**
 * A signed-in pass: who, since when (checking until the server answers, a
 * dash once it couldn't: the page says why), who issued it.
 */
export function passFields(who: { name: string | null; email: string }, createdAt: number | null, unreached = false): PassField[] {
  return [
    { term: 'Name', value: who.name?.trim() || who.email || 'you' },
    { term: 'Email', value: who.email || '—' },
    { term: 'Since', value: createdAt != null ? sinceDate(createdAt) : unreached ? '—' : 'checking…' },
    { term: 'Issuer', value: 'A-01 · PhoneCanDo' },
  ];
}

/** A pass not issued yet: the blanks it would fill. */
export const BLANK_FIELDS: readonly PassField[] = [
  { term: 'Name', value: 'Your name here' },
  { term: 'Email', value: '—' },
  { term: 'Since', value: 'not yet' },
  { term: 'Issuer', value: 'A-01, at the door' },
];

/** A-01's line by the door while signed out: holding it, checking the ID, or the sign-in didn't take. */
export function doorLine(state: 'idle' | 'signingIn' | 'failed'): string {
  switch (state) {
    case 'signingIn':
      return 'A-01 · checking your ID…';
    case 'failed':
      return "A-01 · that didn't take. Try again?";
    case 'idle':
      return 'A-01 · holding the door. No rush.';
  }
}

export const FOLLOWS_TITLE = 'What follows you';
export const FOLLOWS_TITLE_OUT = 'What would follow you';

/** The settings that come with a signed-in person (flows/settingsSync.ts), as SYNCED names them. */
export const FOLLOWS: readonly { title: string; line: string }[] = [
  { title: 'Share links', line: 'Your links, and what each one did' },
  { title: 'Theme', line: 'Lights on, lights off or your phone’s' },
  { title: 'Extra keys', line: 'The terminal’s key row, up or with the keyboard' },
  { title: 'Run caps', line: 'How many agents and models run at once' },
];

/** Where each one lives now. */
export function followsNow(signedIn: boolean): string {
  return signedIn ? 'follows you' : 'this phone';
}

/** The small stamp on each coming feature. */
export const COMING_STAMP = 'soon';

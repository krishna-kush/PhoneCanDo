// What the license ask says (the hello sheet's line at first launch, the
// sheet that asks on its own later), our license's page and About's row. The license itself is licenseText.ts, generated from the
// repo's LICENSE. Pure (zero RN imports).
import { dayMonthYear } from '../common/dates.ts';

/** Over the license sheet's title: whose license, which version. */
export function askKicker(version: string): string {
  return `PhoneCanDo · license ${version}`;
}

/** The license sheet's title: an install from before we asked, or one asked again after a new version. */
export function askTitle(reAsk: boolean): string {
  return reAsk ? 'Our license changed' : 'One thing before you carry on';
}

/** On the first shift's hello, above its buttons: either one agrees. */
export const AGREE_LINE = 'By continuing, you agree to our license.';
export const READ_IT = 'Read it';

/** Under the short version: I agree takes the whole license ([title], its first line), not the summary. */
export function wholeLicenseLine(title: string): string {
  return `Tapping I agree means you accept the full ${title}, not just this summary.`;
}

/** Above the buttons on a re-ask: it changed, and to which version. */
export function changedLine(version: string): string {
  return `Our license changed: this is version ${version}.`;
}

export const READ = 'Read the license';
export const AGREE = 'I agree';

// --- the full text ------------------------------------------------------------------

export const TEXT_HEAD = 'Our license';
export const TEXT_NOTE = 'What you agree to by using PhoneCanDo, word for word. The parts we ship from others keep their own licenses (About → Licenses).';
export const CLOSE = 'Close';

// --- About's row --------------------------------------------------------------------

export const ABOUT_ROW = {
  label: 'PhoneCanDo license',
  note: 'The terms you agreed to, word for word',
};

/**
 * Under About's row: the version this build carries, and when you agreed
 * to it ([agreed], null when never; another version's date is not shown).
 */
export function agreedLine(current: string, agreed: { version: string; at: string } | null): string {
  const at = agreed?.version === current ? new Date(agreed.at) : null;
  return at && !Number.isNaN(at.getTime()) ? `version ${current} · agreed ${dayMonthYear(at)}` : `version ${current}`;
}

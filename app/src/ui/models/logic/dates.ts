// A model's dates in one short line: "Released Mar 2026 · Trained to Aug 2025",
// "Released Mar 2026 · Cutoff not published" (a model we know whose vendor
// publishes none), "On Hugging Face since Mar 2026" (any other: its
// repository's creation day can be before the public release, and we can't
// say whether a cutoff was published). Pure (zero RN imports).
import type { ModelDates } from '../../../engine/models/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CUTOFF_NOT_PUBLISHED = 'Cutoff not published';

/** "2026-03" or "2026-03-02" → "Mar 2026"; '' when it is neither. */
export function monthText(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(iso ?? '');
  const month = m ? Number(m[2]) : 0;
  return m && month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${m[1]}` : '';
}

/** The line; '' when there are no dates, or they don't read as dates. */
export function datesLine(dates: ModelDates | null | undefined): string {
  if (!dates) return '';
  if (dates.kind === 'released') {
    const released = monthText(dates.released);
    if (!released) return '';
    const cutoff = monthText(dates.cutoff);
    return `Released ${released} · ${cutoff ? `Trained to ${cutoff}` : CUTOFF_NOT_PUBLISHED}`;
  }
  const since = monthText(dates.since);
  return since ? `On Hugging Face since ${since}` : '';
}

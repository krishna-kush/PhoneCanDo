// The Messages page's day boxes: each day's messages, newest first, in one
// box under its strip ("Today", "Yesterday", "Mon 3 Nov", "3 Nov 2025"),
// as the site's figure keys. Pure (zero RN imports).
import { dayMonth, dayMonthYear } from '../../common/dates.ts';
import type { BarcodeId } from '../../common/rows/barcode/lines.ts';
import { weekdayBarcode } from '../../common/rows/barcode/weekdays.ts';
import { startOfDay } from './messagesCopy.ts';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The strip over a day's box, in the phone's own time zone; a message without a time goes under "Earlier". */
export function dayTitle(sentAt: number, now: number): string {
  if (!(sentAt > 0)) return 'Earlier';
  const today = startOfDay(now);
  if (sentAt >= today) return 'Today';
  if (sentAt >= startOfDay(today - DAY / 2)) return 'Yesterday';
  const at = new Date(sentAt);
  return at.getFullYear() === new Date(now).getFullYear() ? `${WEEKDAYS[at.getDay()]} ${dayMonth(at)}` : dayMonthYear(at);
}

/** The barcode line on a day's box (common/rows/barcode/): today's, yesterday's, no time's, or its weekday's. */
export function dayBarcode(sentAt: number, now: number): BarcodeId {
  if (!(sentAt > 0)) return 'messagesEarlier';
  const today = startOfDay(now);
  if (sentAt >= today) return 'messagesToday';
  if (sentAt >= startOfDay(today - DAY / 2)) return 'messagesYesterday';
  return weekdayBarcode(sentAt);
}

/**
 * Where a message sits in its day's box: `title` on the first of its day
 * (the box opens with that strip), `gap` when a box above it closed, and
 * `last` on the last of its day (the box closes under it, no rule).
 */
export type BoxPlace = { title: string | null; gap: boolean; last: boolean };

export function boxPlaces(messages: readonly { id: number; sentAt: number }[], now: number): Map<number, BoxPlace> {
  const day = (sentAt: number) => (sentAt > 0 ? startOfDay(sentAt) : 0);
  const places = new Map<number, BoxPlace>();
  messages.forEach((m, i) => {
    const here = day(m.sentAt);
    const first = i === 0 || day(messages[i - 1].sentAt) !== here;
    const last = i === messages.length - 1 || day(messages[i + 1].sentAt) !== here;
    places.set(m.id, { title: first ? dayTitle(m.sentAt, now) : null, gap: first && i > 0, last });
  });
  return places;
}

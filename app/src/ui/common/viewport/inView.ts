// Whether a row shows in a scrolling page's window. Pure (zero RN imports).

/** A stretch down the page in dp: a row in the scroll content, or the window over it (scroll offset and height). */
export type Span = { top: number; height: number };

/** True when any of `row` shows in `view`; nothing shows before the window has a height. */
export function inView(row: Span, view: Span): boolean {
  return row.height > 0 && view.height > 0 && row.top < view.top + view.height && row.top + row.height > view.top;
}

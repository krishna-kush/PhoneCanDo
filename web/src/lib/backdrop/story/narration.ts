// The story's words, over each floor in the right margin, set in the page's
// serif like a picture book's text: the chapter's title in red italic, then
// its lines. A line comes in word by word as the story reaches it; the
// newest is in full ink, the ones before it fade back. The first line is up
// before Little arrives, so a floor you scroll to already says what it is
// about.

import { span } from '../species/motion';
import type { Room } from './room';

/** Where the block's last line sits over the floor, world units, and how tall it may grow. */
const BASE = 250;
const MAX_H = 330;
const INSET = 18;
const MAX_W = 320;
/** Seconds between one word and the next coming in, and for each to fade up. */
const WORD = 0.07;
const FADE = 0.4;

type Row = { words: { text: string; x: number }[] };

/** [lit]: the world is dark, so the words are set light. */
export function drawNarration(room: Room, title: string, lines: string[], times: number[], coda?: string, lit = false) {
  const { pen, sec } = room;
  const { pal } = pen;
  const width = Math.min(MAX_W, room.margin - INSET * 2);
  if (width < 80) return;
  const px = Math.max(13, Math.min(19, width / 15));
  const lead = px * 1.3;
  const type = { px, serif: true, weight: 400 };
  const space = pen.measure(' ', 0, type);
  const shown = lines
    .map((text, k) => ({ text, at: times[k] ?? 0 }))
    .filter(({ at }) => at === 0 || sec >= at)
    .map((line) => ({ ...line, rows: layout(line.text, width, (s) => pen.measure(s, 0, type), space) }));
  // Oldest lines go first when the block would grow too tall.
  const gap = px * 0.6;
  const height = (ls: typeof shown) => ls.reduce((h, l) => h + l.rows.length * lead + gap, 0);
  while (shown.length > 1 && height(shown) > MAX_H) shown.shift();
  const codaPx = px * 1.9;
  const end = times.length ? times[times.length - 1] + 1.6 : Infinity;
  const codaShown = coda && sec >= end;
  const x = room.edge(INSET, 0, width);
  const ink = lit ? pal.artFg : pal.fg;
  let y = room.y - BASE - height(shown) - (codaShown ? codaPx * 1.4 : 0) + lead;

  const heading = title.charAt(0).toUpperCase() + title.slice(1);
  pen.text(heading, x, y - lead * 1.25, 0, { px: px * 1.1, serif: true, italic: true, weight: 400, color: pal.red });

  shown.forEach((line, n) => {
    const newest = n === shown.length - 1;
    let w = 0;
    line.rows.forEach((row, r) => {
      for (const word of row.words) {
        const fresh = line.at === 0 ? 1 : span(sec, line.at + w * WORD, line.at + w * WORD + FADE);
        w++;
        if (fresh <= 0) continue;
        // Each word rises a little into place as it fades up.
        pen.faded(fresh * (newest ? 1 : 0.5), () =>
          pen.text(word.text, x + word.x, y + r * lead + (1 - fresh) * px * 0.35, 0, { ...type, color: ink }),
        );
      }
    });
    y += line.rows.length * lead + gap;
  });
  if (codaShown && coda) {
    const k = span(sec, end, end + 1.2);
    pen.faded(k, () => pen.text(coda, x, y + codaPx * 0.6 + (1 - k) * 8, 0, { px: codaPx, serif: true, color: pal.red }));
  }
}

/** Words to rows no wider than [width], each word with its x along its row. */
function layout(text: string, width: number, measure: (s: string) => number, space: number): Row[] {
  const rows: Row[] = [];
  let row: Row = { words: [] };
  let x = 0;
  for (const word of text.split(' ')) {
    const w = measure(word);
    if (row.words.length && x + w > width) {
      rows.push(row);
      row = { words: [] };
      x = 0;
    }
    row.words.push({ text: word, x });
    x += w + space;
  }
  if (row.words.length) rows.push(row);
  return rows;
}

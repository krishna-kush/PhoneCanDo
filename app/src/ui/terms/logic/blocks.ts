// Our license as its page draws it. LICENSE is wrapped for a terminal, so
// each of its paragraphs, headings and list items becomes one block here,
// its wrapped lines joined back into one for the phone to wrap at its own
// width. Only those line breaks go: every word stays, in order. Pure (zero
// RN imports).

export type LicenseBlock =
  /** The first paragraph: the license's name and version. */
  | { kind: 'title'; text: string }
  /** A numbered section's name, a paragraph of one line ("1. Definitions"). */
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  /** A list item: its mark ("-", "a."), and 1 when it sits indented (a list inside an item), else 0. */
  | { kind: 'item'; mark: string; depth: 0 | 1; text: string };

// A list item's first line: its indent, its mark (a dash, or a letter and a dot) and its words.
const ITEM = /^(\s*)(-|[a-z]\.)\s+(\S.*)$/;
// A section's name: its number and a dot, then its words.
const HEADING = /^\d+\.\s+\S/;

/** The license's name and version: its first line. */
export function licenseTitle(text: string): string {
  return text.split('\n', 1)[0].trim();
}

export function licenseBlocks(text: string): LicenseBlock[] {
  const blocks: LicenseBlock[] = [];
  for (const lines of paragraphs(text)) {
    if (blocks.length === 0) {
      blocks.push({ kind: 'title', text: lines.map((line) => line.trim()).join(' ') });
      continue;
    }
    if (lines.length === 1 && HEADING.test(lines[0])) {
      blocks.push({ kind: 'heading', text: lines[0].trim() });
      continue;
    }
    // An item's first line opens a block; any other line joins the open one.
    let open: LicenseBlock | null = null;
    for (const line of lines) {
      const item = ITEM.exec(line);
      if (item) {
        open = { kind: 'item', mark: item[2], depth: item[1].length > 0 ? 1 : 0, text: item[3].trim() };
        blocks.push(open);
      } else if (open) {
        open.text = `${open.text} ${line.trim()}`;
      } else {
        open = { kind: 'paragraph', text: line.trim() };
        blocks.push(open);
      }
    }
  }
  return blocks;
}

/** The text's paragraphs: each run of lines between blank ones. */
function paragraphs(text: string): string[][] {
  const out: string[][] = [];
  let run: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim()) {
      run.push(line.trimEnd());
    } else if (run.length) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return out;
}

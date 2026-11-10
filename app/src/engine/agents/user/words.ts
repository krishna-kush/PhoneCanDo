// Words typed in the custom agent form, read as a shell splits them but
// with nothing expanded: blanks separate words; single quotes keep all
// inside them, double quotes all but \" and \\, and a backslash outside
// quotes keeps the next character. joinWords writes argv back so that
// splitWords reads the same argv. Pure (zero RN imports).

export type Split = { ok: true; words: string[] } | { ok: false; problem: 'quote' };

export function splitWords(text: string): Split {
  const words: string[] = [];
  let word: string | null = null;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else word += ch;
    } else if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === '\\' && (text[i + 1] === '"' || text[i + 1] === '\\')) word += text[++i];
      else word += ch;
    } else if (/\s/.test(ch)) {
      if (word !== null) words.push(word);
      word = null;
    } else {
      word ??= '';
      if (ch === "'" || ch === '"') quote = ch;
      else if (ch === '\\' && i + 1 < text.length) word += text[++i];
      else word += ch;
    }
  }
  if (quote) return { ok: false, problem: 'quote' };
  if (word !== null) words.push(word);
  return { ok: true, words };
}

// Bare when nothing in it needs quoting, else in single quotes ('\'' for one).
function quoted(word: string): string {
  if (word !== '' && !/[\s'"\\]/.test(word)) return word;
  return `'${word.replace(/'/g, "'\\''")}'`;
}

export function joinWords(words: readonly string[]): string {
  return words.map(quoted).join(' ');
}

/** A list typed with blanks or commas between its items (package names). */
export function splitList(text: string): string[] {
  return text.split(/[\s,]+/).filter((item) => item !== '');
}

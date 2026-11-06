// Split a migration file into single statements, for drivers that run one
// statement per call (D1's prepare(), whose exec() also breaks on newlines).

/**
 * Statements of `sql` without comments or trailing `;`. Understands `--` and
 * `/* *\/` comments, '...' strings, "..." / `...` / [...] identifiers, and
 * CREATE TRIGGER bodies (a `;` inside BEGIN ... END does not end the statement).
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let leading: string[] = []; // first words of the current statement, to spot CREATE [TEMP] TRIGGER
  let trigger = false;
  let depth = 0; // BEGIN/CASE ... END nesting inside a trigger body

  const end = (): void => {
    const s = cur.trim();
    if (s) out.push(s);
    cur = '';
    leading = [];
    trigger = false;
    depth = 0;
  };

  let i = 0;
  while (i < sql.length) {
    const c = sql[i]!;
    const next = sql[i + 1];
    if (c === '-' && next === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      cur += ' ';
    } else if (c === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? sql.length : close + 2;
      cur += ' ';
    } else if (c === "'" || c === '"' || c === '`' || c === '[') {
      const closer = c === '[' ? ']' : c;
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === closer) {
          if (closer !== ']' && sql[j + 1] === closer) j += 2; // doubled quote = escaped quote
          else break;
        } else j++;
      }
      cur += sql.slice(i, j + 1);
      i = j + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /[A-Za-z0-9_$]/.test(sql[j]!)) j++;
      const word = sql.slice(i, j);
      cur += word;
      i = j;
      const w = word.toUpperCase();
      if (leading.length < 3) {
        leading.push(w);
        trigger =
          leading[0] === 'CREATE' &&
          (leading[1] === 'TRIGGER' || ((leading[1] === 'TEMP' || leading[1] === 'TEMPORARY') && leading[2] === 'TRIGGER'));
      }
      if (trigger) {
        if (w === 'BEGIN' || w === 'CASE') depth++;
        else if (w === 'END') depth--;
      }
    } else if (c === ';') {
      if (trigger && depth > 0) cur += c;
      else end();
      i++;
    } else {
      cur += c;
      i++;
    }
  }
  end();
  return out;
}

// Delimited blocks our config plugins own in generated Gradle files.
//
// Prebuild without --clean feeds the previous output back to the plugins, so
// each run removes its block and writes the current text: an edited plugin
// reaches an existing android/, and repeated prebuilds are byte-identical.
// Blocks from before the begin/end markers (one marker line, then code up to
// a braced block) are migrated by removing them first.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const beginMarker = (tag) => `// phonecando: ${tag} begin`;
const endMarker = (tag) => `// phonecando: ${tag} end`;

// `body` is whole lines (newline-terminated) at their final indentation.
function block(tag, indent, body) {
  return `${indent}${beginMarker(tag)}\n${body}${indent}${endMarker(tag)}\n`;
}

// Remove every copy of the tag's block, whole lines from begin to end.
function strip(contents, tag) {
  const re = new RegExp(
    `^[ \\t]*${escape(beginMarker(tag))}\\n[\\s\\S]*?^[ \\t]*${escape(endMarker(tag))}[ \\t]*(?:\\n|$)`,
    'gm',
  );
  return contents.replace(re, '');
}

// The span of an old single-marker block: from its marker line to the brace
// closing the first `{` matched by `opener` after it. Null when absent.
function legacySpan(contents, marker, opener) {
  const line = new RegExp(`^([ \\t]*)${escape(marker)}[ \\t]*$`, 'm').exec(contents);
  if (!line) return null;
  const found = opener.exec(contents.slice(line.index));
  if (!found) {
    throw new Error(`"${marker}" block has no ${opener}; regenerate android/ with prebuild --clean`);
  }
  const open = line.index + found.index + found[0].length - 1;
  return { start: line.index, end: closingBrace(contents, open) + 1, indent: line[1] };
}

// Drop an old block with its trailing newline and the blank line the old
// plugins put before it.
function stripLegacy(contents, marker, opener) {
  const span = legacySpan(contents, marker, opener);
  if (!span) return contents;
  const start = contents.slice(0, span.start).endsWith('\n\n') ? span.start - 1 : span.start;
  const end = contents[span.end] === '\n' ? span.end + 1 : span.end;
  return contents.slice(0, start) + contents.slice(end);
}

function insertAt(contents, index, text) {
  return contents.slice(0, index) + text + contents.slice(index);
}

// After the first match of `anchor`, which must end at a line start.
function insertAfter(contents, anchor, text, what) {
  const m = anchor.exec(contents);
  if (!m) throw new Error(`${what} not found`);
  return insertAt(contents, m.index + m[0].length, text);
}

// Before the line holding the first match of `anchor`.
function insertBeforeLine(contents, anchor, text, what) {
  const m = anchor.exec(contents);
  if (!m) throw new Error(`${what} not found`);
  return insertAt(contents, contents.lastIndexOf('\n', m.index) + 1, text);
}

// At the end of the file, one blank line after the last code line.
function append(contents, text) {
  return `${contents.replace(/\n*$/, '\n')}\n${text}`;
}

// Index of the `}` matching the `{` at `open`; skips strings and // comments.
function closingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '"' || c === "'") {
      for (i += 1; i < text.length && text[i] !== c; i += 1) if (text[i] === '\\') i += 1;
    } else if (c === '{') {
      depth += 1;
    } else if (c === '}' && --depth === 0) {
      return i;
    }
  }
  throw new Error('unbalanced braces in a generated Gradle file');
}

module.exports = { block, strip, legacySpan, stripLegacy, insertAfter, insertBeforeLine, append };

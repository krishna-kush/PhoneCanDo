// Reading source for the dependency checks: walking a tree, the imports of a
// JS/TS file, and Kotlin with its comments removed. Zero deps.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Folders never walked: dependencies, build outputs, generated native trees.
const SKIP = new Set(['node_modules', 'build', 'dist', '.gradle', '.kotlin', '.git', '.expo', '.astro', '.wrangler', '.data', 'android', 'ios']);

/** Every file under `dir` whose name ends with one of `exts`. */
export function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

/** `path` relative to `root`, with forward slashes. */
export const relPath = (root, path) => relative(root, path).split(sep).join('/');

/** The 1-based line of a character offset. */
export const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const blank = (s) => s.replace(/[^\n]/g, ' ');

// JS/TS: blanks block comments that open a line or follow whitespace, and
// whole-line `//` comments, keeping offsets so line numbers stay right.
// Line-anchored like tce's checker: a glob such as '**/*.ts' in a string is
// left alone.
function blankJsComments(src) {
  return src
    .replace(/(^|(?<=\s))\/\*[\s\S]*?\*\//gm, blank)
    .replace(/^[ \t]*\/\/.*$/gm, blank);
}

/** Every module a JS/TS file imports: `{ spec, typeOnly, line }`. */
export function importsOf(src) {
  const s = blankJsComments(src);
  const out = [];
  const add = (m, spec, typeOnly) => out.push({ spec, typeOnly, line: lineOf(s, m.index) });
  // Anchored to the start of a statement so strings that mention "import" do not match.
  for (const m of s.matchAll(/^[ \t]*(?:import|export)\s+(type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"\n]+)['"]/gm)) {
    add(m, m[2], Boolean(m[1]));
  }
  for (const m of s.matchAll(/^[ \t]*import\s*['"]([^'"\n]+)['"]/gm)) add(m, m[1], false);
  for (const m of s.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g)) add(m, m[1], false);
  return out;
}

/** Kotlin without comments (block comments nest), keeping strings and every newline. */
export function stripKotlin(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (src.startsWith('/*', i)) {
      let depth = 0;
      do {
        if (src.startsWith('/*', i)) { depth++; i += 2; continue; }
        if (src.startsWith('*/', i)) { depth--; i += 2; continue; }
        if (src[i] === '\n') out += '\n';
        i++;
      } while (i < src.length && depth > 0);
    } else if (src.startsWith('"""', i)) {
      const end = src.indexOf('"""', i + 3);
      const stop = end < 0 ? src.length : end + 3;
      out += src.slice(i, stop);
      i = stop;
    } else if (src[i] === '"' || src[i] === "'") {
      const stop = quotedEnd(src, i);
      out += src.slice(i, stop);
      i = stop;
    } else {
      out += src[i++];
    }
  }
  return out;
}

// The index just past a one-line "string" or 'c'har literal starting at i.
function quotedEnd(src, i) {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== quote && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
  return Math.min(j + 1, src.length);
}

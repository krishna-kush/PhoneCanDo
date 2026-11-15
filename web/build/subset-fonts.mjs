// Cuts the four first-load fonts (Fontsource's latin files of Geist, Geist
// Mono and Instrument Serif) down to the characters the built site holds,
// after `astro build`. Every glyph a default OpenType feature reaches from
// them stays (HarfBuzz's layout closure) and Geist keeps its whole weight
// axis untouched (narrowing it re-encodes the in-between weights), so the
// text looks exactly as before; the file just drops what no page can show.
// A cut file gets a new hashed name, and every page and stylesheet is
// pointed at it, so a year-long cache never serves an older cut.
//
// The other Fontsource files (latin-ext, cyrillic, ...) and the .woff
// fallbacks are left alone: a character outside the cut still falls through
// to them as before.

import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

/** The latin files the pages preload or use first. */
const FIRST_LOAD = /^(geist|geist-mono)-latin-wght-normal\.|^instrument-serif-latin-400-(normal|italic)\./;
/** Text files whose characters may reach the screen. */
const TEXT = /\.(html|css|js|json|webmanifest)$/;

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path)));
    else out.push(path);
  }
  return out;
}

/** Every character the site's text holds, printable ASCII always included. */
function charactersOf(texts) {
  const chars = new Set();
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (const text of texts) {
    // \uXXXX escapes in scripts and JSON hold characters too.
    const unescaped = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    for (const ch of text + unescaped) if (ch.codePointAt(0) >= 0x20) chars.add(ch);
  }
  return [...chars].join('');
}

const hashOf = (data) => createHash('sha256').update(data).digest('base64url').slice(0, 8);

export default function subsetFonts() {
  return {
    name: 'phonecando:subset-fonts',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const all = await files(dist);
        const textFiles = all.filter((f) => TEXT.test(f));
        const texts = new Map();
        for (const f of textFiles) texts.set(f, await readFile(f, 'utf8'));
        const chars = charactersOf(texts.values());

        const renames = new Map();
        for (const path of all.filter((f) => f.endsWith('.woff2') && FIRST_LOAD.test(f.split('/').pop()))) {
          const before = await readFile(path);
          const after = await subsetFont(before, chars, { targetFormat: 'woff2' });
          const name = path.split('/').pop();
          const cut = name.replace(/\.[\w-]+\.woff2$/, `.${hashOf(after)}.woff2`);
          await writeFile(join(path, '..', cut), after);
          await rm(path);
          renames.set(name, cut);
          logger.info(`${name} ${(before.length / 1024).toFixed(1)} KB -> ${cut} ${(after.length / 1024).toFixed(1)} KB`);
        }

        for (const [f, text] of texts) {
          let next = text;
          for (const [from, to] of renames) next = next.replaceAll(from, to);
          if (next !== text) await writeFile(f, next);
        }
        logger.info(`${renames.size} fonts cut to ${[...chars].length} characters; ${relative(process.cwd(), dist)} updated`);
      },
    },
  };
}

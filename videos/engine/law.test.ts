// The package's dependency law, kept by a test: engine ← brand ← films.
// The engine knows nothing of our brand or of any film, the brand knows no
// film, and the engine's pure parts (beats, motion, sound) import neither
// Remotion nor React, so the sound side runs in plain Node and a film's
// beat line can be read anywhere.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LAYERS = ['engine', 'brand', 'films'] as const;
const PURE = ['engine/beats/', 'engine/motion/', 'engine/sound/'];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.tsx?$/.test(e.name) ? [path] : [];
  });
}

/** Every module a file imports: a package's name, or a file's path from the package root. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs = [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g), ...text.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g), ...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  return specs.map((s) => (s.startsWith('.') ? relative(ROOT, resolve(dirname(file), s)).split(sep).join('/') : s));
}

const files = LAYERS.flatMap((layer) => sources(join(ROOT, layer))).map((file) => ({ path: relative(ROOT, file).split(sep).join('/'), imports: importsOf(file) }));

test('the engine imports nothing of the brand or of a film', () => {
  for (const f of files.filter((x) => x.path.startsWith('engine/'))) {
    for (const i of f.imports) assert.ok(!i.startsWith('brand/') && !i.startsWith('films/'), `${f.path} imports ${i}`);
  }
});

test('the brand imports nothing of a film', () => {
  for (const f of files.filter((x) => x.path.startsWith('brand/'))) {
    for (const i of f.imports) assert.ok(!i.startsWith('films/'), `${f.path} imports ${i}`);
  }
});

test('beats, motion and sound import neither Remotion nor React', () => {
  for (const f of files.filter((x) => PURE.some((p) => x.path.startsWith(p)))) {
    for (const i of f.imports) assert.ok(!/^(remotion|@remotion\/|react(-dom)?(\/|$))/.test(i), `${f.path} imports ${i}`);
  }
});

test('a film imports no other film', () => {
  for (const f of files.filter((x) => x.path.startsWith('films/') && x.path.split('/').length > 2)) {
    const own = `films/${f.path.split('/')[1]}/`;
    for (const i of f.imports) assert.ok(!i.startsWith('films/') || i.startsWith(own), `${f.path} imports ${i}`);
  }
});

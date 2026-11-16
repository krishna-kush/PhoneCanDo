// The second-opinion row on a fake git: no test spawns git.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hearingGate } from './gate.mjs';
import { TRUST_AREAS, trustChanges } from './trust.mjs';

const PIN = { version: '1.0.0', commit: '3bdf98356946e35ec270283ad039516044fae7b9' };
const SHA = 'a872e7b186c5560d021286a5ee3133ba28db01a3';
const gitWith = (answer) => ({ changedSince: () => answer });
const gate = (answer, hearing = PIN) => hearingGate({ hearing, git: gitWith(answer), sha: SHA });

test('no pin, no row', () => {
  assert.equal(hearingGate({ hearing: null, git: gitWith({ state: 'ok', files: [] }), sha: SHA }), null);
});

test('nothing a reviewer checks changed: ok, no reminder', () => {
  const row = gate({ state: 'ok', files: ['web/src/pages/index.astro', 'app/app.json', 'docs/README.md'] });
  assert.equal(row.ok, true);
  assert.equal(row.remind, false);
  assert.match(row.summary, /v1\.0\.0 @ 3bdf983 still holds/);
});

test('trust paths changed: still ok, but reminds, area by area', () => {
  const row = gate({
    state: 'ok',
    files: ['pce/core/src/Tap.kt', 'tce/ops/ingest.ts', 'app/modules/phonecando-linux/android/src/main/AndroidManifest.xml'],
  });
  assert.equal(row.ok, true);
  assert.equal(row.overridable, false);
  assert.equal(row.remind, true);
  assert.match(row.summary, /^3 file\(s\) a reviewer checks changed since v1\.0\.0 @ 3bdf983/);
  assert.deepEqual(row.detail.map((line) => line.split(':')[0]), [
    'what leaves the phone',
    'Accessibility and the screen',
    'how the APK is built',
  ]);
});

test('a pin this clone lacks is not checked; one off this history reminds', () => {
  const missing = gate({ state: 'missing' });
  assert.equal(missing.remind, false);
  assert.match(missing.summary, /not in this clone/);
  const diverged = gate({ state: 'diverged' });
  assert.equal(diverged.ok, true);
  assert.equal(diverged.remind, true);
  assert.match(diverged.summary, /pin it again/);
});

test('trust patterns: folder and file prefixes, and **/name anywhere', () => {
  const areas = [{ name: 'a', paths: ['pce/', 'app/src/engine/updates', '**/AndroidManifest.xml'] }];
  const hit = (file) => trustChanges([file], areas).length === 1;
  assert.equal(hit('pce/x.kt'), true);
  assert.equal(hit('pcex/x.kt'), false);
  assert.equal(hit('app/src/engine/updates.ts'), true);
  assert.equal(hit('app/src/engine/updates/manifest.ts'), true);
  assert.equal(hit('app/x/AndroidManifest.xml'), true);
  assert.equal(hit('AndroidManifest.xml'), true);
  assert.equal(hit('app/x/NotAndroidManifest.xml'), false);
});

test('every trust area names at least one path', () => {
  for (const area of TRUST_AREAS) assert.ok(area.paths.length > 0, area.name);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFacts } from '../facts/load.ts';
import { sectionsOf } from '../timeline/cues.ts';
import { TOTAL } from '../timeline/scenes.ts';
import { BEAT } from '../timeline/tempo.ts';
import { integrated } from './mix/loudness.ts';
import { db, truePeak } from './mix/truepeak.ts';
import { SR, sampleOf } from './rate.ts';
import { CEILING, render, TARGET } from './render.ts';
import { planOf } from './score/plan.ts';

test('the whole soundtrack: as long as the video, at the platforms’ loudness, under the ceiling, silent where it should be', () => {
  const track = render(loadFacts());
  const n = Math.round(TOTAL * BEAT * SR);
  for (const s of [track.music, track.sfx, track.mix]) {
    assert.equal(s.l.length, n);
    assert.equal(s.r.length, n);
  }
  assert.ok([...track.mix.l, ...track.mix.r].every(Number.isFinite));
  assert.ok(Math.abs(integrated(track.mix) - TARGET) < 0.3, 'about -14 LUFS');
  assert.ok(db(truePeak(track.mix)) <= CEILING + 0.05, 'true peak under the ceiling');
  for (const q of planOf(sectionsOf(), TOTAL).silences) {
    let top = 0;
    for (let i = sampleOf(q.from); i < sampleOf(q.to); i++) top = Math.max(top, Math.abs(track.music.l[i]), Math.abs(track.music.r[i]));
    assert.equal(top, 0, `the music is silent from beat ${q.from} to ${q.to}`);
  }
  // Faded out by the end.
  assert.ok(Math.abs(track.mix.l[n - 1]) < 1e-4 && Math.abs(track.mix.r[n - 1]) < 1e-4);
});
